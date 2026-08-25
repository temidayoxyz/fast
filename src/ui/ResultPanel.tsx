import { useState } from 'react';
import type { TestResult } from '../engine/engine';
import { loadHistory } from '../lib/history';
import { encodeResult } from '../lib/share';
import { fmt, unitLabel, verdict, type Unit } from '../lib/units';

export function ResultPanel({ result, unit }: { result: TestResult; unit: Unit }) {
  // history[0] is this run (the engine saved it before we rendered)
  const prev = loadHistory()[1];
  const delta = prev ? ((result.downMbps - prev.d) / prev.d) * 100 : null;
  const [copied, setCopied] = useState(false);

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
    <div className="flex items-center justify-between gap-3 border-t border-graphite/60 pt-3">
      <div className="flex items-baseline gap-3 sm:gap-4 min-w-0 flex-wrap">
        <span className="font-display font-medium tracking-[0.08em]">
          {verdict(result.downMbps)}
        </span>
        <span className="text-xs tabular-nums whitespace-nowrap">
          ↓ {fmt(result.downMbps, unit)} · ↑ {fmt(result.upMbps, unit)}{' '}
          <span className="text-ash">{unitLabel(unit)}</span>
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
  );
}
