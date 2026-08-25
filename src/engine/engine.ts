// SpeedTest — the orchestrator. Owns the phase state machine, the shared
// 100ms tick, stability-based stop rules, and the high-frequency channel.
//
// Two channels keep React out of the hot path:
//   coarse: subscribe()/getSnapshot() — fires ONLY on phase changes/results
//   hot:    onTick()                  — fires every 100ms; consumers read
//                                        `live` (mutable) and draw via refs

import { runDownload } from './download';
import { LoadedProbes, measureIdle, type PopInfo } from './latency';
import { cv as coeffVar, trimmedMean, type Sample } from './stats';
import {
  startUploadBlob,
  startUploadStreaming,
  supportsStreamingUpload,
  type ByteCounter,
} from './upload';
import { addHistory } from '../lib/history';
import { bloatGrade } from '../lib/units';

export type Phase = 'idle' | 'latency' | 'download' | 'upload' | 'done' | 'aborted';

const RUNNING: ReadonlySet<Phase> = new Set(['latency', 'download', 'upload']);

export interface TestResult {
  downMbps: number;
  upMbps: number;
  pingMs: number;
  jitterMs: number;
  bloatMs: number;
  bloatGrade: string;
  streams: number;
  uploadMode: 'stream' | 'blob';
  pop: PopInfo;
  finishedAt: number;
}

export interface Snapshot {
  phase: Phase;
  error: string | null;
  result: TestResult | null;
  pop: PopInfo | null;
  streams: number;
}

/** Mutable high-frequency state — read inside rAF/tick callbacks, never React state. */
export interface Live {
  instant: number; // rolling Mbps right now
  progress: number; // 0..1 through current transfer phase
  down: number; // finalized scores
  up: number;
  ping: number;
  jitter: number;
  samples: Sample[]; // post-warm-up trace record
  probes: { at: number; ms: number }[]; // loaded-latency marks (performance.now clock)
  startedAt: number; // graph time-domain start
  endedAt: number; // 0 while any phase is running
}

const TICK_MS = 100;
const WARMUP_MS = 800; // discard ramp-up: TLS, slow start, cold asset cache
const ROLLING_MS = 750; // instant-readout smoothing window
const STABLE_WINDOW_MS = 3000;
const CV_MAX = 0.06;
const STABLE_WINDOWS_NEEDED = 3;

const DL_MIN_MS = 5000;
const DL_CAP_MS = 12000;
const UL_MIN_MS = 4000;
const UL_CAP_MS = 10000;

export class SpeedTest {
  private snap: Snapshot = { phase: 'idle', error: null, result: null, pop: null, streams: 6 };
  private listeners = new Set<() => void>();
  private tickers = new Set<() => void>();

  private ctl: AbortController | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private loaded = new LoadedProbes();
  private userAborted = false;
  private naturalStop = false;

  readonly live: Live = {
    instant: 0, progress: 0, down: 0, up: 0, ping: 0, jitter: 0,
    samples: [], probes: [], startedAt: 0, endedAt: 0,
  };

  // per-transfer-phase internals
  private phaseStart = 0;
  private totalBytes = 0; // download path accumulates here
  private counter: ByteCounter | null = null; // upload path polls this
  private deque: { t: number; b: number }[] = [];
  private stableRuns = 0;
  private minMs = DL_MIN_MS;
  private capMs = DL_CAP_MS;
  private kind: 'd' | 'u' = 'd';

  get running(): boolean {
    return RUNNING.has(this.snap.phase);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): Snapshot => this.snap;

  /** Hot channel: fired every tick; consumers pull from `live`. */
  onTick = (fn: () => void): (() => void) => {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  };

  start = (streams: number): void => {
    if (this.running) return;
    this.stopTicker();
    this.loaded.stop();
    this.userAborted = false;
    this.naturalStop = false;
    Object.assign(this.live, {
      instant: 0,
      progress: 0,
      down: 0,
      up: 0,
      ping: 0,
      jitter: 0,
      probes: [],
      startedAt: performance.now(),
      endedAt: 0,
    });
    this.live.samples = [];
    this.snap = { ...this.snap, streams, error: null, result: null, pop: null };
    this.ctl = new AbortController();
    this.setPhase('latency');
    void this.run(this.ctl, streams);
  };

  abort = (): void => {
    if (!this.running) return;
    this.userAborted = true;
    this.naturalStop = false;
    this.ctl?.abort();
  };

  /** Render a shared link's result without running anything. */
  loadShared = (result: TestResult): void => {
    if (this.running) return;
    Object.assign(this.live, {
      down: result.downMbps,
      up: result.upMbps,
      ping: result.pingMs,
      jitter: result.jitterMs,
    });
    this.snap = { ...this.snap, result, pop: result.pop };
    this.setPhase('done');
  };

  // ------------------------------------------------------------------

  private async run(ctl: AbortController, streams: number): Promise<void> {
    try {
      const idle = await measureIdle(ctl.signal);
      if (this.checkUserAbort()) return;
      this.live.ping = idle.medianMs;
      this.live.jitter = idle.jitterMs;
      this.snap = {
        ...this.snap,
        pop: { colo: idle.colo, city: idle.city, country: idle.country },
      };
      this.emit(); // PoP badge can appear mid-run

      this.loaded.start(ctl.signal);

      // ---- download ----
      this.beginTransfer('d', DL_MIN_MS, DL_CAP_MS);
      await this.settle(
        runDownload({
          streams,
          signal: ctl.signal,
          onBytes: (n) => {
            this.totalBytes += n;
          },
        }),
      );
      this.live.down = this.finalizeTransfer();
      if (this.checkUserAbort()) return;

      // ---- upload ----
      this.beginTransfer('u', UL_MIN_MS, UL_CAP_MS);
      const streaming = supportsStreamingUpload();
      const run = streaming
        ? startUploadStreaming({ streams, signal: ctl.signal })
        : startUploadBlob({ streams, signal: ctl.signal });
      this.counter = run.counter;
      await this.settle(run.promise);
      this.live.up = this.finalizeTransfer();
      this.loaded.stop();

      // ---- record ----
      const bloat = this.loaded.bloatMs(idle.medianMs);
      const result: TestResult = {
        downMbps: this.live.down,
        upMbps: this.live.up,
        pingMs: idle.medianMs,
        jitterMs: idle.jitterMs,
        bloatMs: bloat,
        bloatGrade: bloatGrade(bloat),
        streams,
        uploadMode: streaming ? 'stream' : 'blob',
        pop: this.snap.pop ?? { colo: '', city: '', country: '' },
        finishedAt: Date.now(),
      };
      addHistory(result);
      this.snap = { ...this.snap, result };
      this.setPhase('done');
    } catch (err) {
      this.stopTicker();
      this.loaded.stop();
      const failed = err instanceof Error && err.name !== 'AbortError';
      this.snap = {
        ...this.snap,
        error: failed ? 'CONNECTION FAILED — CHECK NETWORK' : null,
      };
      this.setPhase('aborted');
    }
  }

  /** true when the user cancelled (vs the ticker's natural stop) */
  private checkUserAbort(): boolean {
    if (!this.userAborted) return false;
    this.stopTicker();
    this.loaded.stop();
    this.setPhase('aborted');
    return true;
  }

  /** swallow the AbortError that a natural stop produces */
  private async settle(p: Promise<void>): Promise<void> {
    try {
      await p;
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError' && this.naturalStop)) throw err;
    }
  }

  private beginTransfer(kind: 'd' | 'u', minMs: number, capMs: number): void {
    this.kind = kind;
    this.minMs = minMs;
    this.capMs = capMs;
    this.totalBytes = 0;
    this.counter = null;
    this.deque = [];
    this.stableRuns = 0;
    this.live.instant = 0;
    this.live.progress = 0;
    this.ctl = new AbortController(); // fresh per phase — natural stops don't poison the next one
    this.phaseStart = performance.now();
    this.setPhase(kind === 'd' ? 'download' : 'upload');
    this.ticker = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const now = performance.now();
    const elapsed = now - this.phaseStart;
    const total = this.kind === 'd' ? this.totalBytes : (this.counter?.total(now) ?? 0);

    this.deque.push({ t: now, b: total });
    while (this.deque.length > 2 && now - this.deque[0].t > ROLLING_MS) this.deque.shift();
    const first = this.deque[0];
    const span = now - first.t;
    // bytes over milliseconds → Mbps: ΔB · 8 / (Δms · 1000)
    this.live.instant = span >= 150 ? ((total - first.b) * 8) / (span * 1000) : 0;

    if (elapsed >= WARMUP_MS) {
      this.live.samples.push({ t: elapsed / 1000, v: this.live.instant, k: this.kind });
    }

    if (elapsed >= this.minMs) {
      const cutoffS = (elapsed - STABLE_WINDOW_MS) / 1000;
      const window = this.live.samples.filter((s) => s.k === this.kind && s.t >= cutoffS).map((s) => s.v);
      if (window.length >= 8 && coeffVar(window) < CV_MAX) this.stableRuns++;
      else this.stableRuns = 0;
      if (this.stableRuns >= STABLE_WINDOWS_NEEDED || elapsed >= this.capMs) {
        this.stopTicker();
        this.naturalStop = true;
        this.ctl?.abort();
      }
    }

    this.live.progress = Math.min(1, elapsed / this.capMs);
    this.live.probes = this.loaded.marks();
    for (const fn of this.tickers) fn();
  }

  private finalizeTransfer(): number {
    const vals = this.live.samples.filter((s) => s.k === this.kind).map((s) => s.v);
    const score = trimmedMean(vals);
    this.live.instant = score;
    this.live.progress = 1;
    return score < 0.05 ? 0 : score;
  }

  private stopTicker(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
  }

  private setPhase(phase: Phase): void {
    if (!RUNNING.has(phase) && this.live.endedAt === 0) {
      this.live.endedAt = performance.now();
    }
    this.snap = { ...this.snap, phase };
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const speedTest = new SpeedTest();
