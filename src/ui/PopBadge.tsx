import type { PopInfo } from '../engine/latency';

/**
 * Edge PoP + network badge, fed by request.cf off the first latency probe.
 * ISP on md+ screens; hover carries the full ISP (ASN) and your IP — context
 * Cloudflare attaches to every request anyway, so it costs nothing.
 */
export function PopBadge({ pop }: { pop: PopInfo | null }) {
  if (!pop || !(pop.colo || pop.city)) {
    return <span className="text-[11px] tracking-[0.18em] text-graphite select-none">⌁ ——</span>;
  }
  const city = pop.city ? pop.city.toUpperCase().slice(0, 14) : '';
  const code = pop.colo.toUpperCase();
  const isp = pop.isp ? pop.isp.toUpperCase().slice(0, 18) : '';
  const title = [
    pop.isp ? `${pop.isp}${pop.asn ? ` (AS${pop.asn})` : ''}` : '',
    pop.ip || '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      title={title || undefined}
      className="text-[11px] tracking-[0.18em] text-ash select-none tabular-nums truncate"
    >
      ⌁ {city}
      {city && code ? ' · ' : ''}
      {code}
      {isp && <span className="hidden md:inline"> · {isp}</span>}
    </span>
  );
}
