import { useEffect, useRef } from 'react';
import { speedTest } from '../engine/engine';
import { autoParts } from '../lib/units';

/** The readout follows its own transfer, then holds the completed value. */
export function BigReadout({ kind }: { kind: 'd' | 'u' }) {
  const num = useRef<HTMLSpanElement>(null);
  const unit = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const paint = (): void => {
      if (!num.current || !unit.current) return;
      const live = speedTest.live;
      const phase = speedTest.getSnapshot().phase;
      const finished = kind === 'd' ? live.down : live.up;
      const active = phase === (kind === 'd' ? 'download' : 'upload');
      const parts = autoParts(active ? live.instant : finished);
      num.current.textContent = parts.num;
      unit.current.textContent = parts.label;
    };
    paint();
    const offTick = speedTest.onTick(paint);
    const offCoarse = speedTest.subscribe(paint);
    return () => {
      offTick();
      offCoarse();
    };
  }, [kind]);

  return (
    <div className="flex items-baseline gap-2 tabular-nums" aria-label={`${kind === 'd' ? 'Download' : 'Upload'} speed`}>
      <span ref={num} className={`font-display font-bold leading-none tracking-[-0.06em] text-[clamp(52px,7vw,82px)] ${kind === 'd' ? 'text-down' : 'text-up'}`}>
        0.0
      </span>
      <span ref={unit} className="text-base sm:text-lg text-ash">Mbps</span>
    </div>
  );
}
