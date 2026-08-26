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
    b: round2(r.bloatMs),
    s: r.streams,
    m: r.uploadMode,
    c: [r.pop.colo, r.pop.city, r.pop.country, r.pop.isp, r.pop.asn, r.pop.ip],
    t: r.finishedAt,
  };
  return `#r=${b64url(JSON.stringify(payload))}`;
}

export function decodeResult(hash: string): TestResult | null {
  const m = /^#r=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(unb64url(m[1])) as Record<string, unknown>;
    const num = (k: string): number =>
      typeof o[k] === 'number' && Number.isFinite(o[k]) ? (o[k] as number) : NaN;
    const d = num('d');
    const p = num('p');
    if (!Number.isFinite(d) || !Number.isFinite(p)) return null;
    const c = Array.isArray(o.c) ? (o.c as string[]) : ['', '', ''];
    const bloat = num('b');
    return {
      downMbps: d,
      upMbps: num('u'),
      pingMs: p,
      jitterMs: num('j'),
      bloatMs: Number.isFinite(bloat) ? bloat : 0,
      bloatGrade: bloatGrade(Number.isFinite(bloat) ? bloat : 999),
      streams: typeof o.s === 'number' ? o.s : 6,
      uploadMode: o.m === 'stream' ? 'stream' : 'blob',
      pop: {
        colo: c[0] ?? '',
        city: c[1] ?? '',
        country: c[2] ?? '',
        isp: c[3] ?? '',
        asn: typeof c[4] === 'number' ? c[4] : 0,
        ip: c[5] ?? '',
      },
      finishedAt: typeof o.t === 'number' ? o.t : Date.now(),
    };
  } catch {
    return null;
  }
}
