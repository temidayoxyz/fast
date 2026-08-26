import { useState } from 'react';
import type { TestResult } from '../engine/engine';
import { loadHistory } from '../lib/history';
import { encodeResult } from '../lib/share';
import { fmtAuto, quality, verdict, type QualityRating } from '../lib/units';

function Rating({ label, value }: { label: string; value: QualityRating['streaming'] }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] tracking-[0.18em] text-ash">{label}</span>
      <span
        className={`text-[10px] tracking-[0.14em] ${
          value === 'BAD'
            ? 'bg-signal text-void px-1.5 font-semibold'
            : value === 'GOOD'
              ? 'text-signal'
              : 'text-ash'
        }`}
      >
        {value}
      </span>
    </span>
  );
}

export function ResultPanel({ result }: { result: TestResult }) {
  // history[0] is this run (the engine saved it before we rendered)
  const prev = loadHistory()[1];
  const delta = prev ? ((result.downMbps - prev.d) / prev.d) * 100 : null;
  const [copied, setCopied] = useState(false);
  const q = quality(result);

  const share = async (): Promise<void> => {
    const url = `${location.origin}${location.pathname}${encodeResult(result)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-2 border-t border-graphite/60 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 sm:gap-4 min-w-0 flex-wrap">
          <span className="font-display font-medium tracking-[0.08em]">
            {verdict(result.downMbps)}
          </span>
          <span className="text-xs tabular-nums whitespace-nowrap">
            ↓ {fmtAuto(result.downMbps)} · ↑ {fmtAuto(result.upMbps)}
          </span>
          {delta !== null && Number.isFinite(delta) && (
            <span className="text-[11px] text-ash tabular-nums shrink-0 hidden sm:inline">
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% VS LAST
            </span>
          )}
        </div>
        <button
          onClick={() => void share()}
          className="shrink-0 text-[10px] tracking-[0.2em] text-ash hover:text-signal border border-graphite hover:border-signal px-3 h-8 transition-colors cursor-pointer"
        >
          {copied ? 'COPIED' : 'COPY LINK'}
        </button>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
        <Rating label="VIDEO" value={q.streaming} />
        <Rating label="GAMING" value={q.gaming} />
        <Rating label="CHAT" value={q.chat} />
      </div>
    </div>
  );
}
