import type { PopInfo } from '../engine/latency';

/** Edge PoP indicator, fed by request.cf off the first latency probe. */
export function PopBadge({ pop }: { pop: PopInfo | null }) {
  if (!pop || !(pop.colo || pop.city)) {
    return <span className="text-[11px] tracking-[0.18em] text-graphite select-none">⌁ ——</span>;
  }
  const city = pop.city ? pop.city.toUpperCase().slice(0, 14) : '';
  const code = pop.colo.toUpperCase();
  return (
    <span className="text-[11px] tracking-[0.18em] text-ash select-none tabular-nums">
      ⌁ {city}
      {city && code ? ' · ' : ''}
      {code}
    </span>
  );
}
