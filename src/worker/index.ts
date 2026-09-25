// Fast XYZ worker — the entire backend. Three API endpoints:
//   /api/latency — tiny JSON probe; doubles as the PoP/ISP info source
//                  (request.cf is free context Cloudflare attaches anyway)
//   /api/upload  — drains the request body counting bytes (I/O-bound, ~zero CPU)
//   /api/preview-meta — localhost-only lookup of Cloudflare test edge metadata
// Everything else is static assets, served without touching this script
// thanks to run_worker_first: ["/api/*"].

import { isLocalHost } from '../lib/host';

interface Env {
  ASSETS: Fetcher;
}

const coordinate = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

async function networkHolder(asn: number): Promise<string> {
  if (!Number.isSafeInteger(asn) || asn <= 0) return '';
  try {
    const res = await fetch(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asn}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return '';
    const data = await res.json() as { data?: { holder?: unknown } };
    const holder = data.data?.holder;
    if (typeof holder !== 'string') return '';
    const name = holder.trim().slice(0, 120);
    const halves = name.split(' - ');
    return halves.length === 2 && halves[0].toLowerCase() === halves[1].toLowerCase()
      ? halves[0]
      : name;
  } catch {
    return '';
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    const json = (body: unknown): Response =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });

    if (pathname === '/api/latency') {
      return json({
        colo: req.cf?.colo ?? '',
        city: req.cf?.city ?? '',
        country: req.cf?.country ?? '',
        lat: coordinate(req.cf?.latitude, -90, 90),
        lon: coordinate(req.cf?.longitude, -180, 180),
        isp: req.cf?.asOrganization ?? '',
        asn: req.cf?.asn ?? 0,
        ip: req.headers.get('cf-connecting-ip') ?? '',
      });
    }

    if (pathname === '/api/preview-meta') {
      if (!isLocalHost(new URL(req.url).hostname)) return new Response(null, { status: 404 });
      try {
        const upstream = await fetch('https://speed.cloudflare.com/__down?bytes=0', { cache: 'no-store' });
        if (!upstream.ok) return new Response(null, { status: 502 });
        const h = upstream.headers;
        const asn = Number(h.get('asn')) || 0;
        return json({
          colo: h.get('colo') ?? '',
          city: h.get('city') ?? '',
          country: h.get('country') ?? '',
          lat: coordinate(h.get('latitude'), -90, 90),
          lon: coordinate(h.get('longitude'), -180, 180),
          isp: await networkHolder(asn),
          asn,
          ip: h.get('cf-meta-ip') ?? '',
        });
      } catch {
        return new Response(null, { status: 502 });
      }
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      let bytes = 0;
      if (req.body) {
        const reader = req.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
          }
        } catch (err) {
          // The client stops an in-flight POST when the timed sample ends.
          // A disconnected request has no recipient for a response, but it
          // must not become an uncaught Worker error in local development.
          if (
            err instanceof Error &&
            (err.name === 'AbortError' || err.message === 'Network connection lost.')
          ) return new Response(null, { status: 204 });
          throw err;
        }
      }
      return json({ bytes });
    }

    // Defensive fallback; run_worker_first makes this near-unreachable.
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
