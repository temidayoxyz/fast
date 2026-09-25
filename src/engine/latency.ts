// Latency probes: idle (clean line) + loaded (fired DURING bulk transfer,
// deliberately queueing behind traffic — that queueing IS bufferbloat).

import { meanAbsDelta, median } from './stats';
import { latencyUrl, publicPreview } from '../lib/test-target';

export interface PopInfo {
  colo: string;
  city: string;
  country: string;
  lat: number | null;
  lon: number | null;
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
  let info: PopInfo = { colo: '', city: '', country: '', lat: null, lon: null, isp: '', asn: 0, ip: '' };

  for (let i = 0; i < PROBE_COUNT && !signal.aborted; i++) {
    const t0 = performance.now();
    const res = await fetch(latencyUrl(), {
      cache: 'no-store',
      signal,
    });
    if (!res.ok) throw new Error(`Latency probe returned HTTP ${res.status}`);
    const j = publicPreview ? null : (await res.json()) as PopInfo;
    if (publicPreview) {
      await res.arrayBuffer(); // Cloudflare's zero-byte response still needs draining
      info.ip ||= res.headers.get('cf-meta-ip') ?? '';
    }
    const rtt = performance.now() - t0;
    if (i === 0) continue; // first probe warms the connection; discard
    rtts.push(rtt);
    if (j && !info.colo) info = j;
  }
  if (publicPreview && !signal.aborted) {
    try {
      const res = await fetch('/api/preview-meta', { cache: 'no-store', signal });
      if (res.ok) info = { ...info, ...(await res.json()) as PopInfo };
    } catch {
      // Throughput and latency remain valid if optional location metadata fails.
    }
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
        const res = await fetch(latencyUrl(), { cache: 'no-store', signal });
        if (!res.ok) return;
        await res.arrayBuffer(); // measure the same full response as idle latency
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

  /** Null means there were too few successful probes to grade the connection. */
  bloatMs(idleMedianMs: number): number | null {
    const ms = this.entries.map((e) => e.ms);
    return ms.length >= 4 ? Math.max(0, median(ms) - idleMedianMs) : null;
  }
}
