import { useEffect, useRef } from 'react';
import { speedTest, type Live, type Snapshot } from '../engine/engine';

/** Tile formatters read engine state directly — no React state in the hot path. */
export const pingTile = (live: Live): string =>
  live.ping > 0 ? `${live.ping.toFixed(1)} ms` : '—';

export const jitterTile = (live: Live): string =>
  live.jitter > 0 ? `${live.jitter.toFixed(1)} ms` : '—';

export const extraDelayTile = (_live: Live, snap: Snapshot): string => {
  const r = snap.result;
  if (r) return r.bloatMs === null ? '—' : `${Math.round(r.bloatMs)} ms`;
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
    // repaint on ticks AND phase transitions — terminal values (loaded delay,
    // finalized scores) only exist after the last tick has fired
    const offTick = speedTest.onTick(paint);
    const offCoarse = speedTest.subscribe(paint);
    return () => {
      offTick();
      offCoarse();
    };
  }, [props.format]);

  return (
    <div className="border border-graphite bg-panel px-3 py-3 sm:px-4 sm:py-4 min-w-0">
      <div className="font-mono text-[9px] sm:text-[10px] tracking-[0.12em] text-ash">{props.label}</div>
      <div
        ref={ref}
        className="mt-2 font-display font-semibold tabular-nums truncate text-base sm:text-2xl"
      >
        —
      </div>
    </div>
  );
}
