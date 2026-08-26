// Fast XYZ worker — the entire backend. Two endpoints, both trivially cheap:
//   /api/latency — tiny JSON probe; doubles as the PoP/ISP info source
//                  (request.cf is free context Cloudflare attaches anyway)
//   /api/upload  — drains the request body counting bytes (I/O-bound, ~zero CPU)
// Everything else is static assets, served without touching this script
// thanks to run_worker_first: ["/api/*"].

interface Env {
  ASSETS: Fetcher;
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
        isp: req.cf?.asOrganization ?? '',
        asn: req.cf?.asn ?? 0,
        ip: req.headers.get('cf-connecting-ip') ?? '',
      });
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      let bytes = 0;
      if (req.body) {
        const reader = req.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
        }
      }
      return json({ bytes });
    }

    // Defensive fallback; run_worker_first makes this near-unreachable.
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
