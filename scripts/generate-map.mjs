// Generates a self-hosted map. Natural Earth countries are public domain;
// colo locations are MIT-licensed airport approximations (see data/).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const readJson = (name) => JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8'));
const countries = readJson('countries.geojson');
const locations = readJson('colo-locations.json');
const round = (value) => Math.round(value * 10) / 10;
const project = ([lon, lat]) => [round(((lon + 180) / 360) * 1000), round(((90 - lat) / 180) * 500)];

function ringPath(ring) {
  const parts = [];
  let run = [];
  let priorLon = null;
  for (const point of ring) {
    if (priorLon !== null && Math.abs(point[0] - priorLon) > 180) {
      if (run.length > 2) parts.push(`M${run.map((xy) => xy.join(',')).join('L')}Z`);
      run = [];
    }
    run.push(project(point));
    priorLon = point[0];
  }
  if (run.length > 2) parts.push(`M${run.map((xy) => xy.join(',')).join('L')}Z`);
  return parts.join('');
}

function geometryPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map(ringPath)).join('');
}

const paths = countries.features
  .filter((feature) => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')
  .map((feature) => `<path d="${geometryPath(feature.geometry)}"/>`)
  .join('');

const edges = Object.fromEntries(
  locations
    .filter((place) => /^[A-Z]{3}$/.test(place.iata) && Number.isFinite(place.lat) && Number.isFinite(place.lon))
    .map((place) => [place.iata, { lat: place.lat, lon: place.lon, city: place.city }]),
);
const dots = Object.values(edges)
  .map((place) => {
    const [x, y] = project([place.lon, place.lat]);
    return `<circle cx="${x}" cy="${y}" r="1.3"/>`;
  })
  .join('');
const xml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Static SVG labels need collision handling because the panel starts zoomed in.
// Prefer major countries, then admit smaller ones where there is room.
const placed = [];
const labels = countries.features
  .filter((feature) => Number(feature.properties?.LABELRANK) <= 4 && Number.isFinite(feature.properties?.LABEL_X) && Number.isFinite(feature.properties?.LABEL_Y))
  .sort((a, b) => a.properties.LABELRANK - b.properties.LABELRANK)
  .map((feature) => {
    const [x, y] = project([feature.properties.LABEL_X, feature.properties.LABEL_Y]);
    const name = feature.properties.NAME.toUpperCase();
    const box = { left: x - name.length * 2.4 - 3, right: x + name.length * 2.4 + 3, top: y - 10, bottom: y + 3 };
    if (placed.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) return '';
    placed.push(box);
    return `<text x="${x}" y="${y}" text-anchor="middle">${xml(name)}</text>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><g fill="#373d45" stroke="#252a31" stroke-width="0.55" fill-rule="evenodd">${paths}</g><g fill="#c7834b" opacity="0.8">${dots}</g><g fill="#b3bbc5" opacity="0.7" font-family="Arial,sans-serif" font-size="8" font-weight="600">${labels}</g></svg>`;
const mapDir = new URL('../src/assets/', import.meta.url);
mkdirSync(mapDir, { recursive: true });
writeFileSync(new URL('world.svg', mapDir), svg);

const typed = `/** Approximate airport coordinates for Cloudflare colo codes. See scripts/data/COLO-LICENSE.txt. */\nexport const EDGE_LOCATIONS: Record<string, { lat: number; lon: number; city: string }> = ${JSON.stringify(edges)};\n`;
writeFileSync(new URL('../src/lib/edge-locations.ts', import.meta.url), typed);
console.log(`generated map (${countries.features.length} countries, ${Object.keys(edges).length} edge locations)`);
