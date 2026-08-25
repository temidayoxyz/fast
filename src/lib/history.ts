// Run history in localStorage — the "database" is the browser. Capped at 20.

import type { TestResult } from '../engine/engine';

const KEY = 'fastxyz.history.v1';
const CAP = 20;

export interface HistoryEntry {
  t: number; // finishedAt (epoch ms)
  d: number; // down Mbps
  u: number; // up Mbps
  p: number; // ping ms
  j: number; // jitter ms
  g: string; // bloat grade
  s: number; // streams used
  c: string; // colo code
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(r: TestResult): void {
  try {
    const entry: HistoryEntry = {
      t: r.finishedAt,
      d: Math.round(r.downMbps * 100) / 100,
      u: Math.round(r.upMbps * 100) / 100,
      p: Math.round(r.pingMs * 10) / 10,
      j: Math.round(r.jitterMs * 10) / 10,
      g: r.bloatGrade,
      s: r.streams,
      c: r.pop.colo,
    };
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadHistory()].slice(0, CAP)));
  } catch {
    /* storage unavailable (private mode etc.) — history is optional */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** previous run (for the Δ-vs-last line) — the entry being saved is excluded by caller ordering */
export function lastEntry(): HistoryEntry | null {
  return loadHistory()[0] ?? null;
}
