import { useEffect, useRef } from 'react';
import { speedTest, type Live, type Phase } from '../engine/engine';
import type { Sample } from '../engine/stats';

const HEIGHT = 120;
const WINDOW = 300; // visible samples (~30 s at 10 Hz), scrolling right-to-left

const SIGNAL = '#f5f5f5';
const ASH = '#8a8a8a';
const GRID = 'rgba(42, 42, 42, 0.55)';

/**
 * The signature element: a live throughput oscilloscope. Hairline graticule,
 * signal trace scrolling at sample rate, loaded-latency probe marks along the
 * bottom edge. Freezes into a permanent record when the test ends.
 *
 * Redraws are dirty-key driven (phase + sample count) — nothing animates that
 * isn't data, and prefers-reduced-motion is respected for free.
 */
export function GraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let lastKey = '';
    let raf = 0;

    const loop = (): void => {
      const live = speedTest.live;
      const key = `${speedTest.getSnapshot().phase}:${live.samples.length}:${live.probes.length}`;
      if (key !== lastKey) {
        lastKey = key;
        render(ctx, canvas, live, speedTest.getSnapshot().phase);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ height: HEIGHT }}
      className="w-full block"
      aria-label="throughput over time"
    />
  );
}

function render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, live: Live, phase: Phase): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // graticule
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 28; x < w; x += 28) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (const f of [0.25, 0.5, 0.75]) {
    ctx.moveTo(0, Math.round(h * f) + 0.5);
    ctx.lineTo(w, Math.round(h * f) + 0.5);
  }
  ctx.stroke();

  const samples = live.samples.slice(-WINDOW);
  if (samples.length >= 2) drawTrace(ctx, w, h, samples);

  drawProbeMarks(ctx, w, h, live, phase);
}

function drawTrace(ctx: CanvasRenderingContext2D, w: number, h: number, visible: Sample[]): void {
  const maxV = Math.max(1, ...visible.map((s) => s.v)) * 1.15;
  // anchor the latest sample at the right edge; scroll as history accumulates
  const xAt = (i: number): number =>
    w - ((visible.length - 1 - i) / (WINDOW - 1)) * w;
  const yAt = (v: number): number => h - 8 - (v / maxV) * (h - 16);

  // area fill
  ctx.beginPath();
  ctx.moveTo(xAt(0), h - 8);
  visible.forEach((s, i) => ctx.lineTo(xAt(i), yAt(s.v)));
  ctx.lineTo(xAt(visible.length - 1), h - 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245, 245, 245, 0.05)';
  ctx.fill();

  // signal stroke
  ctx.beginPath();
  visible.forEach((s, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(s.v)) : ctx.lineTo(xAt(i), yAt(s.v))));
  ctx.strokeStyle = SIGNAL;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // DL/UL segment labels + divider at the phase boundary
  const firstU = visible.findIndex((s) => s.k === 'u');
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = ASH;
  if (firstU > 0) {
    const bx = xAt(firstU);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, 4);
    ctx.lineTo(bx + 0.5, h - 4);
    ctx.stroke();
    ctx.fillText('UL', Math.min(bx + 6, w - 18), 12);
    ctx.fillText('DL', Math.max(xAt(0), 2), 12);
  } else {
    ctx.fillText('DL', Math.max(xAt(0), 2), 12);
  }
}

function drawProbeMarks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  live: Live,
  phase: Phase,
): void {
  if (!live.startedAt || !live.probes.length) return;
  const end = live.endedAt || performance.now();
  const span = end - live.startedAt;
  if (span <= 0) return;

  for (const p of live.probes) {
    const x = ((p.at - live.startedAt) / span) * w;
    if (x < 0 || x > w) continue;
    // brightness scales with queueing penalty above idle baseline
    const penalty = p.ms - Math.max(live.ping, 1);
    const a = Math.min(0.9, Math.max(0.18, penalty / 60));
    ctx.fillStyle = penalty > 100 ? `rgba(245,245,245,${a})` : `rgba(138,138,138,${a})`;
    ctx.fillRect(Math.round(x), h - 6, 1, 4);
  }

  if (phase !== 'done') {
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillStyle = ASH;
    ctx.fillText('LOADED LATENCY', 2, h - 10);
  }
}
