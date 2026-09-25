// Unit formatting and bufferbloat grading — pure
// functions, no deps. Display units use network-standard bits per second so
// results can be compared directly with other speed tests.

/** Kbps below 1 Mbps, Mbps above. */
export function autoParts(mbps: number): { num: string; label: string } {
  if (!Number.isFinite(mbps) || mbps <= 0) return { num: '0.0', label: 'Mbps' };
  if (mbps < 1) {
    const kb = mbps * 1000;
    return { num: kb < 10 ? kb.toFixed(1) : String(Math.round(kb)), label: 'Kbps' };
  }
  return { num: mbps < 10 ? mbps.toFixed(2) : mbps < 100 ? mbps.toFixed(1) : String(Math.round(mbps)), label: 'Mbps' };
}

export const fmtAuto = (mbps: number): string => {
  const p = autoParts(mbps);
  return `${p.num} ${p.label}`;
};

/** latency-under-load penalty, graded like an instrument tolerance */
export function bloatGrade(ms: number): string {
  if (ms < 5) return 'A';
  if (ms < 30) return 'B';
  if (ms < 60) return 'C';
  if (ms < 100) return 'D';
  return 'F';
}
