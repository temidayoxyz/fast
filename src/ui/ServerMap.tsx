import { useRef, useState } from 'react';
import worldMapUrl from '../assets/world.svg?url';
import type { PopInfo } from '../engine/latency';
import { EDGE_LOCATIONS } from '../lib/edge-locations';

interface Point { x: number; y: number }
interface View { x: number; y: number; width: number; height: number }

function project(lat: number, lon: number): Point {
  return { x: ((lon + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
}

function viewFor(points: Point[]): View {
  if (!points.length) return { x: 390, y: 65, width: 300, height: 235 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  let width = Math.max(280, dx * 1.5, dy * 1.5 * 1.28);
  let height = width / 1.28;
  if (height > 500 || width > 1000) {
    width = 1000;
    height = 500;
  }
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return {
    x: Math.max(0, Math.min(1000 - width, cx - width / 2)),
    y: Math.max(0, Math.min(500 - height, cy - height / 2)),
    width,
    height,
  };
}

function Pin({ point, color, label, radius, labelSide = 'right' }: { point: Point; color: string; label: string; radius: number; labelSide?: 'left' | 'right' }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={radius * 2.1} fill={color} opacity="0.2" />
      <circle cx={point.x} cy={point.y} r={radius} fill={color} stroke="#15191f" strokeWidth={radius / 2.5} />
      <text x={point.x + radius * (labelSide === 'left' ? -1.7 : 1.7)} y={point.y + radius * (labelSide === 'left' ? 2.5 : -1.5)} textAnchor={labelSide === 'left' ? 'end' : 'start'} fill="#f1f3f6" fontSize={radius * 2.4} fontFamily="Space Grotesk, Arial, sans-serif" fontWeight="700" paintOrder="stroke" stroke="#20252c" strokeWidth={radius / 1.7}>
        {label}
      </text>
    </g>
  );
}

export function ServerMap({ pop }: { pop: PopInfo | null }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; start: Point } | null>(null);
  const edge = pop?.colo ? EDGE_LOCATIONS[pop.colo.toUpperCase()] : undefined;
  const client = pop?.lat != null && pop.lon != null ? project(pop.lat, pop.lon) : null;
  const server = edge ? project(edge.lat, edge.lon) : null;
  const base = viewFor([client, server].filter((point): point is Point => point !== null));
  const width = base.width / zoom;
  const height = base.height / zoom;
  const view: View = {
    x: Math.max(0, Math.min(1000 - width, base.x + (base.width - width) / 2 + offset.x)),
    y: Math.max(0, Math.min(500 - height, base.y + (base.height - height) / 2 + offset.y)),
    width,
    height,
  };
  const radius = width / 95;
  const nearby = client && server && Math.hypot(client.x - server.x, client.y - server.y) < radius * 4;
  const label = server && client ? `Map from ${pop?.city || 'your area'} to ${edge?.city || pop?.colo}` : 'Map of Cloudflare edge locations';

  const changeZoom = (factor: number): void => setZoom((value) => Math.max(1, Math.min(4.5, value * factor)));

  return (
    <div className="relative mt-4 aspect-[1.22] w-full overflow-hidden border border-graphite bg-[#30353b]">
      <svg
        className="server-map h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, start: offset };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const box = event.currentTarget.getBoundingClientRect();
          const scale = Math.max(view.width / box.width, view.height / box.height);
          setOffset({
            x: drag.current.start.x - (event.clientX - drag.current.x) * scale,
            y: drag.current.start.y - (event.clientY - drag.current.y) * scale,
          });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onWheel={(event) => { event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.2 : 1 / 1.2); }}
        onDoubleClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
      >
        <rect width="1000" height="500" fill="#30353b" />
        <image href={worldMapUrl} width="1000" height="500" />
        {client && server && (
          <line x1={client.x} y1={client.y} x2={server.x} y2={server.y} stroke="#ff9f53" strokeWidth={radius / 2.6} opacity="0.8" />
        )}
        {client && <Pin point={client} color="#ff817b" label={nearby ? 'Your area' : pop?.city || 'Your area'} radius={radius} labelSide={nearby ? 'left' : 'right'} />}
        {server && <Pin point={server} color="#ff9f53" label={nearby ? `${pop?.colo || 'Edge'} edge` : edge?.city || pop?.colo || 'Edge'} radius={radius} />}
      </svg>
      <div className="absolute bottom-3 right-3 flex flex-col border border-graphite bg-panel/95">
        <button type="button" onClick={() => changeZoom(1.5)} disabled={zoom >= 4.5} className="h-8 w-8 text-lg leading-none disabled:opacity-35 hover:bg-graphite" aria-label="Zoom in map">+</button>
        <button type="button" onClick={() => changeZoom(1 / 1.5)} disabled={zoom <= 1} className="h-8 w-8 border-t border-graphite text-lg leading-none disabled:opacity-35 hover:bg-graphite" aria-label="Zoom out map">−</button>
      </div>
    </div>
  );
}
