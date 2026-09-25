import { useState } from 'react';
import type { TestResult } from '../engine/engine';
import { loadHistory } from '../lib/history';
import { isLocalPreview, LIVE_TEST_URL } from '../lib/environment';
import { encodeResult } from '../lib/share';
import { fmtAuto } from '../lib/units';

function Reading({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-t border-graphite px-5 py-4 sm:border-l sm:border-t-0 sm:first:border-l-0">
      <p className="font-display text-base font-semibold">{label}</p>
      <p className="mt-2 font-mono text-xs font-semibold tracking-[0.08em] text-signal">
        {value}
      </p>
      <p className="mt-1 text-xs text-ash">{detail}</p>
    </div>
  );
}

export function ResultPanel({ result, shared }: { result: TestResult; shared: boolean }) {
  const prev = shared ? null : loadHistory()[1];
  const delta = prev ? ((result.downMbps - prev.d) / prev.d) * 100 : null;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const loadNote = result.bloatMs === null
    ? 'Loaded delay was unavailable in this run.'
    : `Heavy traffic added ${Math.round(result.bloatMs)} ms of delay here.`;

  const share = async (): Promise<void> => {
    const base = isLocalPreview() ? LIVE_TEST_URL : `${location.origin}${location.pathname}`;
    const url = `${base}${encodeResult(result)}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      ta.remove();
    }
    setCopyState(copied ? 'copied' : 'failed');
    setTimeout(() => setCopyState('idle'), 1600);
  };

  return (
    <section className="mt-5 border border-graphite bg-panel" aria-labelledby="quality-title">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 id="quality-title" className="font-display text-lg font-semibold">What the numbers mean</h2>
          <p className="mt-1 text-sm text-ash">
            These measurements are indicators, not pass/fail scores. App servers and other traffic affect what you experience.
          </p>
          {delta !== null && Number.isFinite(delta) && (
            <p className="mt-2 font-mono text-xs text-ash tabular-nums">
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% download vs previous run
            </p>
          )}
        </div>
        <button
          onClick={() => void share()}
          className="h-9 shrink-0 cursor-pointer border border-graphite px-4 font-mono text-[10px] font-semibold tracking-[0.12em] transition-colors hover:border-signal"
        >
          {copyState === 'copied' ? 'COPIED' : copyState === 'failed' ? 'COPY FAILED' : 'COPY LINK'}
        </button>
      </div>
      <div className="grid sm:grid-cols-3 border-t border-graphite">
        <Reading label="Streaming" value={`${fmtAuto(result.downMbps)} DOWN`} detail="Playback quality also depends on the service and resolution." />
        <Reading label="Gaming" value={`${Math.round(result.pingMs)} MS TEST PING`} detail={`Game server ping may differ. ${loadNote}`} />
        <Reading label="Video calls" value={`${fmtAuto(result.upMbps)} UP`} detail={`Call quality also depends on the service and other traffic. ${loadNote}`} />
      </div>
    </section>
  );
}
