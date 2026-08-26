// Unit formatting, use-case quality ratings, bufferbloat grading — pure
// functions, no deps. Display units are byte-based and adaptive (KB/s | MB/s);
// the network's native megabit stays internal.

export interface QualityRating {
  streaming: 'GOOD' | 'OK' | 'BAD';
  gaming: 'GOOD' | 'OK' | 'BAD';
  chat: 'GOOD' | 'OK' | 'BAD';
}

/** KB/s below 1 MB/s, MB/s above — the label tells you which, no toggling. */
export function autoParts(mbps: number): { num: string; label: string } {
  const mbs = mbps / 8;
  if (!Number.isFinite(mbs) || mbs <= 0) return { num: '0.0', label: 'MB/s' };
  if (mbs < 1) {
    const kb = mbs * 1000;
    return { num: kb < 10 ? kb.toFixed(1) : String(Math.round(kb)), label: 'KB/s' };
  }
  return { num: mbs < 10 ? mbs.toFixed(2) : mbs.toFixed(1), label: 'MB/s' };
}

export const fmtAuto = (mbps: number): string => {
  const p = autoParts(mbps);
  return `${p.num} ${p.label}`;
};

export function verdict(mbps: number): string {
  if (mbps >= 500) return 'GIGABIT-CLASS';
  if (mbps >= 200) return 'VERY FAST';
  if (mbps >= 50) return 'FAST';
  if (mbps >= 25) return 'ADEQUATE';
  if (mbps >= 5) return 'SLOW';
  return 'VERY SLOW';
}

/** latency-under-load penalty, graded like an instrument tolerance */
export function bloatGrade(ms: number): string {
  if (ms < 5) return 'A';
  if (ms < 30) return 'B';
  if (ms < 60) return 'C';
  if (ms < 100) return 'D';
  return 'F';
}

/**
 * What the connection is usable FOR, from the numbers people actually
 * experience: bandwidth for streaming, latency+jitter+queueing for gaming,
 * and a bit of everything for video calls. Bands are deliberately generous
 * at OK — BAD should mean "this will visibly suck".
 */
export function quality(m: {
  downMbps: number;
  pingMs: number;
  jitterMs: number;
  bloatMs: number;
}): QualityRating {
  const streaming =
    m.downMbps >= 25 && m.bloatMs < 100
      ? 'GOOD'
      : m.downMbps >= 5 && m.bloatMs < 500
        ? 'OK'
        : 'BAD';
  const gaming =
    m.pingMs < 60 && m.jitterMs < 20 && m.bloatMs < 50
      ? 'GOOD'
      : m.pingMs < 150 && m.jitterMs < 40 && m.bloatMs < 250
        ? 'OK'
        : 'BAD';
  const chat =
    m.pingMs < 100 && m.jitterMs < 30 && m.bloatMs < 150
      ? 'GOOD'
      : m.pingMs < 250 && m.jitterMs < 60 && m.bloatMs < 500
        ? 'OK'
        : 'BAD';
  return { streaming, gaming, chat };
}
