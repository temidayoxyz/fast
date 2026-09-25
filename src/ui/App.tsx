import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { speedTest } from '../engine/engine';
import { useGlobalKeys } from '../lib/keys';
import { decodeResult } from '../lib/share';
import { ConnectionPanel } from './ConnectionPanel';
import { Controls } from './Controls';
import { HistoryTable } from './HistoryTable';
import { MetricTile, bloatTile, jitterTile, pingTile } from './MetricTile';
import { ResultPanel } from './ResultPanel';
import { TransferPanel } from './TransferPanel';

const PHASE_COPY: Partial<Record<string, string>> = {
  idle: 'Ready to measure',
  latency: 'Measuring response time',
  download: 'Measuring download',
  upload: 'Measuring upload',
  aborted: 'Test stopped',
};

export default function App() {
  const snap = useSyncExternalStore(speedTest.subscribe, speedTest.getSnapshot);

  useEffect(() => {
    const loadHash = (): void => {
      const shared = decodeResult(location.hash);
      if (shared) speedTest.loadShared(shared);
    };
    loadHash();
    window.addEventListener('hashchange', loadHash);
    return () => window.removeEventListener('hashchange', loadHash);
  }, []);

  const start = useCallback(() => {
    history.replaceState(null, '', location.pathname + location.search);
    speedTest.start();
  }, []);

  useGlobalKeys({
    onStart: start,
    onAbort: () => speedTest.abort(),
    isRunning: () => speedTest.running,
  });

  const status = snap.error ?? PHASE_COPY[snap.phase];

  return (
    <div className="min-h-dvh bg-void text-signal">
      <header className="border-b border-graphite/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <img className="h-8 w-8" src="/favicon.svg" width="32" height="32" alt="" aria-hidden="true" />
            <span className="font-display text-xl font-bold tracking-[-0.04em]">FAST<span className="text-down">.</span>XYZ</span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.16em] text-ash">NETWORK SPEED TEST</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-12 pt-6 sm:px-8 sm:pt-8">
        <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Your internet speed</h1>
            {snap.phase !== 'done' && (
              <p className={`mt-2 text-sm ${snap.error ? 'text-down' : 'text-ash'}`} role="status">{status}</p>
            )}
          </div>
          <div className="hidden lg:block">
            <Controls
              running={speedTest.running}
              phase={snap.phase}
              onStart={start}
              onAbort={() => speedTest.abort()}
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <TransferPanel kind="d" phase={snap.phase} />
            <TransferPanel kind="u" phase={snap.phase} />
            <div className="lg:hidden">
              <Controls
                running={speedTest.running}
                phase={snap.phase}
                onStart={start}
                onAbort={() => speedTest.abort()}
              />
            </div>
            <section aria-labelledby="response-title">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="response-title" className="font-display text-lg font-semibold">Response time</h2>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ash">LOWER IS BETTER</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <MetricTile label="PING" format={pingTile} />
                <MetricTile label="JITTER" format={jitterTile} />
                <MetricTile label="BLOAT" format={bloatTile} />
              </div>
            </section>
          </div>
          <ConnectionPanel pop={snap.pop} />
        </div>

        {snap.phase === 'done' && snap.result && (
          <ResultPanel result={snap.result} shared={snap.shared} />
        )}
        <div className="mt-6"><HistoryTable revision={snap.result?.finishedAt ?? 0} /></div>
      </main>
    </div>
  );
}
