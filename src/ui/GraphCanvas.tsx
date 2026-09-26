import { useEffect, useRef } from 'react';
import { speedTest, type Live } from '../engine/engine';
import type { Sample } from '../engine/stats';

const HEIGHT = 104;
const WINDOW = 300;

/** Separate live traces keep download and upload easy to scan. */
export function GraphCanvas({ kind }: { kind: 'd' | 'u' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const color = getComputedStyle(canvas).getPropertyValue(kind === 'd' ? '--color-down' : '--color-up').trim();
    let lastKey = '';
    let raf = 0;
    const loop = (): void => {
      const live = speedTest.live;
      const key = `${speedTest.getSnapshot().phase}:${live.samples.length}:${live.probes.length}:${canvas.clientWidth}:${window.devicePixelRatio}`;
      if (key !== lastKey) {
        lastKey = key;
        render(ctx, canvas, live, kind, color);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind]);

  return (
    <canvas
      ref={ref}
      style={{ height: HEIGHT }}
      className="block w-full"
      aria-label={`${kind === 'd' ? 'Download' : 'Upload'} throughput over time`}
    />
  );
}

function render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, live: Live, kind: 'd' | 'u', color: string): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(135, 146, 160, 0.16)';
  ctx.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const y = Math.round(h * f) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const samples = live.samples.filter((sample) => sample.k === kind).slice(-WINDOW);
  if (samples.length < 2) return;
  const start = samples[0].at;
  const end = samples.at(-1)!.at;
  const xAt = (at: number): number => ((at - start) / Math.max(end - start, 1)) * w;
  drawTrace(ctx, h, samples, xAt, color);
  drawProbeMarks(ctx, w, h, live.probes, start, end, xAt);
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  h: number,
  samples: Sample[],
  xAt: (at: number) => number,
  color: string,
): void {
  const max = Math.max(1, ...samples.map((sample) => sample.v)) * 1.12;
  const yAt = (v: number): number => h - 3 - (v / max) * (h - 13);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, `${color}70`);
  gradient.addColorStop(1, `${color}06`);
  ctx.beginPath();
  ctx.moveTo(xAt(samples[0].at), h);
  for (const sample of samples) ctx.lineTo(xAt(sample.at), yAt(sample.v));
  ctx.lineTo(xAt(samples.at(-1)!.at), h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  for (const [index, sample] of samples.entries()) {
    if (index === 0) ctx.moveTo(xAt(sample.at), yAt(sample.v));
    else ctx.lineTo(xAt(sample.at), yAt(sample.v));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawProbeMarks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  probes: Live['probes'],
  start: number,
  end: number,
  xAt: (at: number) => number,
): void {
  ctx.fillStyle = 'rgba(235, 240, 245, 0.55)';
  for (const probe of probes) {
    if (probe.at < start || probe.at > end) continue;
    const x = Math.round(xAt(probe.at));
    if (x >= 0 && x <= w) ctx.fillRect(x, h - 5, 2, 4);
  }
}
