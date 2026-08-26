import { useEffect, useRef } from 'react';
import { speedTest, type Phase } from '../engine/engine';
import { fmt, unitLabel, type Unit } from '../lib/units';

const DIRECTION: Partial<Record<Phase, string>> = {
  latency: '·',
  download: '↓',
  upload: '↑',
};

/**
 * The giant numeral — plain DOM updated via ref (crisper than canvas text,
 * zero React churn). Click the unit line to toggle Mbps / MB/s.
 */
export function BigReadout(props: {
  unit: Unit;
  onUnit: (u: Unit) => void;
  phase: Phase;
}) {
  const num = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paint = (): void => {
      if (!num.current) return;
      const live = speedTest.live;
      const phase = speedTest.getSnapshot().phase;
      const value =
        phase === 'done'
          ? live.down
          : phase === 'download' || phase === 'upload'
            ? live.instant
            : NaN; // idle / latency / aborted → resting zero
      const has = Number.isFinite(value) && value > 0;
      num.current.textContent = has ? fmt(value, props.unit) : '0.0';
      num.current.style.color = has ? 'var(--color-signal)' : 'rgba(138, 138, 138, 0.45)';
    };
    paint();
    // coarse subscription makes the numeral switch to the final download
    // score on `done` — the tick channel alone stops before that repaint
    const offTick = speedTest.onTick(paint);
    const offCoarse = speedTest.subscribe(paint);
    return () => {
      offTick();
      offCoarse();
    };
  }, [props.unit]);

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={num}
        aria-hidden="true"
        className="font-display font-bold tabular-nums leading-[0.95] tracking-tight text-[clamp(64px,17vw,168px)]"
      >
        0.0
      </div>
      <button
        onClick={() => props.onUnit(props.unit === 'mbps' ? 'mbs' : 'mbps')}
        title="toggle units"
        className="mt-1.5 text-[11px] tracking-[0.26em] text-ash hover:text-signal transition-colors cursor-pointer"
      >
        {unitLabel(props.unit)} <span className="tabular-nums">{DIRECTION[props.phase] ?? ''}</span>
      </button>
    </div>
  );
}
