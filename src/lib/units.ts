// Unit math, verdict bands, bufferbloat grading — pure functions, no deps.

export type Unit = 'mbps' | 'mbs';

export const toUnit = (mbps: number, u: Unit): number => (u === 'mbps' ? mbps : mbps / 8);

export const unitLabel = (u: Unit): string => (u === 'mbps' ? 'Mbps' : 'MB/s');

/** adaptive precision: 847.2 / 84.72 / 8.47 */
export function fmt(valueMbps: number, u: Unit): string {
  const x = toUnit(valueMbps, u);
  if (!Number.isFinite(x) || x <= 0) return '—';
  return x.toFixed(x >= 100 ? 1 : x >= 10 ? 2 : 2);
}

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
