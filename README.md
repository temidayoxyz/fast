# FAST XYZ

A compact internet speed instrument. Single Cloudflare Worker, zero backend
state, about **26 KB of JavaScript** gzipped.

## Why

fast.com and speed.cloudflare.com are good instruments wrapped in heavy apps.
Fast XYZ keeps the instrument and loses the weight: no login, no database, no
analytics, no framework bloat — just the measurement.

## What it measures

| Metric | Method |
| --- | --- |
| **Downlink** | One connection pulling 24 MiB test data, byte-counted via `ReadableStream` |
| **Uplink** | One connection sending repeated 2 MiB random-blob POSTs, counted via browser upload progress; the deployed Worker also checks each completed byte count |
| **Latency / jitter** | 12 sequential probes, median + mean absolute delta |
| **Extra delay (bufferbloat)** | Median latency during transfers minus the idle baseline, shown in milliseconds |
| **Edge PoP** | The deployed Worker reports its colo from `request.cf`; localhost uses Cloudflare's public speed-test edge metadata |

The server map plots the visitor's approximate area and the reported Cloudflare
colo at approximate airport coordinates. It supports drag,
scroll zoom, and zoom buttons. The connecting line is a geographic guide,
not a measured network path, and the pin is not an exact data center address.
The local preview tests directly against Cloudflare's public download and upload
endpoints. It never uses localhost for throughput or latency; its local Worker
retrieves the public endpoint's location headers for the map and resolves the
reported ASN to its registered network name through RIPEstat. Old loopback
diagnostics stay out of its internet-test history.
Map shapes come from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)
(public domain). Approximate colo coordinates come from the
[Netrvin Cloudflare colo list](https://github.com/Netrvin/cloudflare-colo-list)
(MIT; license copy in `scripts/data/COLO-LICENSE.txt`).

Download and upload have separate live throughput traces. Loaded-latency
probe marks are drawn along the bottom edge of each trace.

The use-case cards show the relevant measurements with context. They do not
claim that a game or call will fail based on one test server's latency.
The test uses one connection per direction, with no stream setting. This shows
single-transfer performance; tests that use several parallel transfers or
different sampling methods can produce different throughput numbers.

## Engineering notes

- **One deployable unit.** Static assets + API routes in a single Cloudflare
  Worker (`wrangler.jsonc`). `/api/upload` drains bodies and counts bytes;
  everything else is edge-cached static files.
- **Stop-early sampling.** Transfers end when the coefficient of variation
  settles (< 0.06 across consecutive 3 s windows) — typically 6–9 s, not a
  fixed 30 s burn. Final score is a trimmed mean over the stable window.
- **No re-render storms.** React state changes only on phase transitions; the
  100 ms tick feeds canvases and DOM refs directly.
- **Share links without a server.** Results are base64url-encoded into the URL
  hash. History (last 20 runs) lives in `localStorage`.
- **Preact** via `@preact/preset-vite` — React 19's react-dom alone would have
  tripled the bundle.

## Deploys

Push to `main` → Cloudflare Workers Builds builds and deploys automatically.
Live at **https://fast.temidayoxyz.workers.dev**.

## Develop

```bash
npm install
npm run blobs      # generate one 24 MiB random-byte test blob (gitignored)
npm run map        # regenerate the map SVG and edge coordinate table
npm run preview    # build + wrangler dev → http://localhost:8787
npm run check      # typecheck app + worker
npm run deploy     # build + deploy to Cloudflare (free plan is enough)
```

Keyboard: `Space` starts/aborts when focus is outside a control; `Esc` aborts.
The readout switches automatically between Kbps and Mbps.

The local preview measures Internet traffic against Cloudflare's public speed
test service. The deployed app measures against its own Cloudflare Worker. These
may route to different edges, and different speed tests use different payloads
and sampling methods, so results need not match exactly. All speeds use Mbps.

## License

[MIT](LICENSE)
