import type { PopInfo } from '../engine/latency';
import { ServerMap } from './ServerMap';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-graphite/70 py-3">
      <dt className="text-xs text-ash">{label}</dt>
      <dd className="text-right text-xs font-medium tabular-nums break-all">{value || '—'}</dd>
    </div>
  );
}

export function ConnectionPanel({ pop }: { pop: PopInfo | null }) {
  const code = pop?.colo || (pop ? 'UNAVAILABLE' : 'WAITING FOR TEST');
  const visitorArea = pop?.city ? `${pop.city}${pop.country ? `, ${pop.country}` : ''}` : (pop?.country || '');

  return (
    <section className="self-start border border-graphite bg-panel p-5 sm:p-6 min-w-0" aria-labelledby="connection-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="connection-title" className="font-display text-lg font-semibold">Server &amp; network</h2>
      </div>

      <ServerMap pop={pop} />

      <dl className="mt-4">
        <Detail label="Connected via" value={pop?.ip ? (pop.ip.includes(':') ? 'IPv6' : 'IPv4') : ''} />
        <Detail label="Edge code" value={code.toUpperCase()} />
        <Detail label="Your approximate area" value={visitorArea} />
        <Detail label="Your provider" value={pop?.isp || (pop?.asn ? `Network AS${pop.asn}` : '')} />
        {pop?.asn ? <Detail label="Network ID" value={`AS${pop.asn}`} /> : null}
        <Detail label="Your IP" value={pop?.ip || ''} />
      </dl>
    </section>
  );
}
