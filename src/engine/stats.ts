// Shared statistics primitives for the measurement engine.

export interface Sample {
  /** seconds since phase start */
  t: number;
  /** Mbps at this tick */
  v: number;
  /** which transfer produced it */
  k: 'd' | 'u';
}

export const mean = (a: number[]): number =>
  (a.length && a.reduce((s, x) => s + x, 0) / a.length) || 0;

export const stdev = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

/** coefficient of variation — the engine's stability metric */
export const cv = (a: number[]): number => {
  const m = mean(a);
  return m > 0 ? stdev(a) / m : Infinity;
};

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** drop the low/high tails — robust against ramp-up spikes and stalls */
export function trimmedMean(a: number[], cut = 0.1): number {
  if (a.length < 8) return mean(a);
  const s = [...a].sort((x, y) => x - y);
  const lo = Math.floor(s.length * cut);
  const hi = Math.ceil(s.length * (1 - cut));
  return mean(s.slice(lo, hi));
}

export const meanAbsDelta = (a: number[]): number => {
  if (a.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < a.length; i++) sum += Math.abs(a[i] - a[i - 1]);
  return sum / (a.length - 1);
};
