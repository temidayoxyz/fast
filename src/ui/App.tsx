import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { speedTest } from '../engine/engine';
import { useGlobalKeys } from '../lib/keys';
import { decodeResult } from '../lib/share';
import type { Unit } from '../lib/units';
import { BigReadout } from './BigReadout';
import { Controls } from './Controls';
import { GraphCanvas } from './GraphCanvas';
import { HistoryTable } from './HistoryTable';
import { MetricTile, bloatTile, jitterTile, pingTile } from './MetricTile';
import { PopBadge } from './PopBadge';
import { ResultPanel } from './ResultPanel';

const PHASE_COPY: Partial<Record<string, string>> = {
  idle: 'READY — PRESS START',
  latency: 'MEASURING LATENCY',
  download: 'MEASURING DOWNLINK',
  upload: 'MEASURING UPLINK',
};

export default function App() {
  const snap = useSyncExternalStore(speedTest.subscribe, speedTest.getSnapshot);
  const [unit, setUnit] = useState<Unit>('mbps');
  const [streams, setStreams] = useState(6);
  const streamsRef = useRef(streams);
  streamsRef.current = streams;

  // A shared link renders its result immediately; strip it before a fresh run.
  useEffect(() => {
    const shared = decodeResult(location.hash);
    if (shared) speedTest.loadShared(shared);
  }, []);

  const start = useCallback(() => {
    history.replaceState(null, '', location.pathname + location.search);
    speedTest.start(streamsRef.current);
  }, []);

  useGlobalKeys({
    onStart: start,
    onAbort: () => speedTest.abort(),
    isRunning: () => speedTest.running,
  });

  const statusLine =
    snap.error ?? (snap.phase === 'aborted' ? 'ABORTED' : (PHASE_COPY[snap.phase] ?? ''));

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 shrink-0 flex items-center justify-between px-5 sm:px-8 border-b border-graphite/60">
        <div className="flex items-center gap-2.5">
          <svg width="15" height="15" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M6 18h4.5l2.5-7 4.5 10 2.5-5H26"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display font-medium text-sm tracking-[0.28em] select-none">
            FAST XYZ
          </span>
        </div>
        <PopBadge pop={snap.pop} />
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 py-6 w-full max-w-xl mx-auto">
        <p
          className={`text-[11px] tracking-[0.24em] ${snap.error ? 'text-signal' : 'text-ash'}`}
          role="status"
        >
          {statusLine || ' '}
        </p>

        <BigReadout unit={unit} onUnit={setUnit} phase={snap.phase} />

        <div className="w-full">
          <GraphCanvas />
        </div>

        <div className="w-full grid grid-cols-3 gap-2 sm:gap-3">
          <MetricTile label="PING" format={pingTile} />
          <MetricTile label="JITTER" format={jitterTile} />
          <MetricTile label="BLOAT" format={bloatTile} />
        </div>
      </main>

      <footer className="shrink-0 w-full max-w-xl mx-auto px-4 pb-6 pt-2 space-y-3">
        {snap.phase === 'done' && snap.result && <ResultPanel result={snap.result} />}
        <Controls
          streams={streams}
          onStreams={setStreams}
          running={speedTest.running}
          phase={snap.phase}
          onStart={start}
          onAbort={() => speedTest.abort()}
        />
        <HistoryTable revision={snap.result?.finishedAt ?? 0} />
      </footer>
    </div>
  );
}
