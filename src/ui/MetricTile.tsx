import { useEffect, useRef } from 'react';
import { speedTest, type Live, type Snapshot } from '../engine/engine';

/** Tile formatters read engine state directly — no React state in the hot path. */
export const pingTile = (live: Live): string =>
  live.ping > 0 ? `${live.ping.toFixed(1)} ms` : '—';

export const jitterTile = (live: Live): string =>
  live.jitter > 0 ? `${live.jitter.toFixed(1)} ms` : '—';

export const bloatTile = (_live: Live, snap: Snapshot): string => {
  const r = snap.result;
  if (r) return `${r.bloatGrade} · ${Math.round(r.bloatMs)} ms`;
  return speedTest.running ? '···' : '—';
};

export function MetricTile(props: {
  label: string;
  format: (live: Live, snap: Snapshot) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paint = (): void => {
      if (ref.current) {
        ref.current.textContent = props.format(speedTest.live, speedTest.getSnapshot());
      }
    };
    paint();
    return speedTest.onTick(paint);
  }, [props.format]);

  return (
    <div className="border border-graphite/60 bg-carbon px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
      <div className="text-[9px] sm:text-[10px] tracking-[0.22em] text-ash">{props.label}</div>
      <div
        ref={ref}
        className="mt-1 font-display font-medium tabular-nums truncate text-base sm:text-xl"
      >
        —
      </div>
    </div>
  );
}
