import type { Phase } from '../engine/engine';
import { BigReadout } from './BigReadout';
import { GraphCanvas } from './GraphCanvas';

export function TransferPanel({ kind, phase }: { kind: 'd' | 'u'; phase: Phase }) {
  const download = kind === 'd';
  const active = phase === (download ? 'download' : 'upload');
  const finished = phase === 'done' || (download && phase === 'upload');
  return (
    <section className="border border-graphite bg-panel px-5 pt-4 pb-3 sm:px-6" aria-label={download ? 'Download measurement' : 'Upload measurement'}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className={download ? 'text-down' : 'text-up'} aria-hidden="true">{download ? '↓' : '↑'}</span>
          {download ? 'Download' : 'Upload'}
        </h2>
        <span className={`font-mono text-[10px] tracking-[0.14em] ${active ? download ? 'text-down' : 'text-up' : 'text-ash'}`}>
          {active ? 'MEASURING' : finished ? 'COMPLETE' : 'WAITING'}
        </span>
      </div>
      <div className="mt-2"><BigReadout kind={kind} /></div>
      <div className="mt-2"><GraphCanvas kind={kind} /></div>
    </section>
  );
}
