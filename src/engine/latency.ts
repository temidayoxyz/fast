// Latency probes: idle (clean line) + loaded (fired DURING bulk transfer,
// deliberately queueing behind traffic — that queueing IS bufferbloat).

import { meanAbsDelta, median } from './stats';

export interface PopInfo {
  colo: string;
  city: string;
  country: string;
  isp: string;
  asn: number;
  ip: string;
}

export interface IdleResult extends PopInfo {
  medianMs: number;
  jitterMs: number;
}

const PROBE_COUNT = 12;

export async function measureIdle(signal: AbortSignal): Promise<IdleResult> {
  const rtts: number[] = [];
  let info: PopInfo = { colo: '', city: '', country: '', isp: '', asn: 0, ip: '' };

  for (let i = 0; i < PROBE_COUNT && !signal.aborted; i++) {
    const t0 = performance.now();
    const res = await fetch(`/api/latency?t=${Math.random()}`, {
      cache: 'no-store',
      signal,
    });
    const j = (await res.json()) as PopInfo; // drain — TTFB alone understates
    const rtt = performance.now() - t0;
    if (i === 0) continue; // first probe warms the connection; discard
    rtts.push(rtt);
    if (!info.colo) info = j;
  }
  return { medianMs: median(rtts), jitterMs: meanAbsDelta(rtts), ...info };
}

export class LoadedProbes {
  private entries: { at: number; ms: number }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start(signal: AbortSignal): void {
    this.entries = [];
    const fire = async (): Promise<void> => {
      const t0 = performance.now();
      try {
        await fetch(`/api/latency?t=${Math.random()}`, { cache: 'no-store', signal });
        this.entries.push({ at: t0, ms: performance.now() - t0 });
      } catch {
        /* aborted mid-probe */
      }
    };
    this.timer = setInterval(() => void fire(), 500);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  marks(): { at: number; ms: number }[] {
    return [...this.entries];
  }

  /** bufferbloat = median(loaded) − median(idle), floored at 0 */
  bloatMs(idleMedianMs: number): number {
    const ms = this.entries.map((e) => e.ms);
    return ms.length >= 4 ? Math.max(0, median(ms) - idleMedianMs) : 0;
  }
}
