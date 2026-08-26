import { useEffect, useRef } from 'react';
import { speedTest, type Phase } from '../engine/engine';
import { autoParts } from '../lib/units';

const DIRECTION: Partial<Record<Phase, string>> = {
  latency: '·',
  download: '↓',
  upload: '↑',
};

/**
 * The giant numeral — plain DOM updated via ref (crisper than canvas text,
 * zero React churn). Units are adaptive: KB/s when slow, MB/s when fast;
 * the label always says which, so there is nothing to toggle.
 */
export function BigReadout() {
  const num = useRef<HTMLDivElement>(null);
  const unit = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const paint = (): void => {
      if (!num.current || !unit.current) return;
      const live = speedTest.live;
      const phase = speedTest.getSnapshot().phase;
      const value =
        phase === 'done'
          ? live.down
          : phase === 'download' || phase === 'upload'
            ? live.instant
            : NaN; // idle / latency / aborted → resting zero
      const has = Number.isFinite(value) && value > 0;
      const parts = autoParts(has ? value : 0);
      num.current.textContent = parts.num;
      num.current.style.color = has ? 'var(--color-signal)' : 'rgba(138, 138, 138, 0.45)';
      unit.current.textContent = `${parts.label} ${DIRECTION[phase] ?? ''}`;
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
  }, []);

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={num}
        aria-hidden="true"
        className="font-display font-bold tabular-nums leading-[0.95] tracking-tight text-[clamp(64px,17vw,168px)]"
      >
        0.0
      </div>
      <span ref={unit} className="mt-1.5 text-[11px] tracking-[0.26em] text-ash">
        MB/s
      </span>
    </div>
  );
}
