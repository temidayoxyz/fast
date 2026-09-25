// Share links without a backend: the whole result rides in the URL hash.
// #r=<base64url(json)> — tolerant decoding, bad hashes are simply ignored.

import type { TestResult } from '../engine/engine';
import { bloatGrade } from './units';

const round2 = (x: number): number => Math.round(x * 100) / 100;

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function unb64url(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeResult(r: TestResult): string {
  const payload = {
    v: 1,
    d: round2(r.downMbps),
    u: round2(r.upMbps),
    p: round2(r.pingMs),
    j: round2(r.jitterMs),
    b: r.bloatMs === null ? null : round2(r.bloatMs),
    s: r.streams,
    m: r.uploadMode,
    c: [r.pop.colo, r.pop.city, r.pop.country, r.pop.isp, r.pop.asn, r.pop.ip, r.pop.lat, r.pop.lon],
    t: r.finishedAt,
  };
  return `#r=${b64url(JSON.stringify(payload))}`;
}

export function decodeResult(hash: string): TestResult | null {
  const m = /^#r=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(unb64url(m[1])) as Record<string, unknown>;
    if (o.v !== 1) return null;
    const num = (k: string): number =>
      typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : NaN;
    const d = num('d');
    const u = num('u');
    const p = num('p');
    const j = num('j');
    if ([d, u, p, j].some((value) => !Number.isFinite(value) || value < 0)) return null;
    const c: unknown[] = Array.isArray(o.c) ? o.c : [];
    const field = (i: number): string => typeof c[i] === 'string' ? c[i] : '';
    const coord = (i: number, min: number, max: number): number | null =>
      typeof c[i] === 'number' && Number.isFinite(c[i]) && (c[i] as number) >= min && (c[i] as number) <= max
        ? c[i] as number : null;
    const bloat = o.b === null ? null : num('b');
    if (bloat !== null && (!Number.isFinite(bloat) || bloat < 0)) return null;
    const streams = typeof o.s === 'number' && [1, 3, 6].includes(o.s) ? o.s : 6;
    return {
      downMbps: d,
      upMbps: u,
      pingMs: p,
      jitterMs: j,
      bloatMs: bloat,
      bloatGrade: bloat === null ? '—' : bloatGrade(bloat),
      streams,
      uploadMode: o.m === 'stream' ? 'stream' : 'blob',
      pop: {
        colo: field(0),
        city: field(1),
        country: field(2),
        lat: coord(6, -90, 90),
        lon: coord(7, -180, 180),
        isp: field(3),
        asn: typeof c[4] === 'number' && Number.isFinite(c[4]) ? c[4] : 0,
        ip: field(5),
      },
      finishedAt: typeof o.t === 'number' && Number.isFinite(o.t) ? o.t : Date.now(),
    };
  } catch {
    return null;
  }
}
