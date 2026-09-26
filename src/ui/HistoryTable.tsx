import { useMemo, useState } from 'react';
import { clearHistory, loadHistory } from '../lib/history';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const speedFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const PREVIEW_COUNT = 5;

export function HistoryTable({ revision }: { revision: number }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [bump, setBump] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revision/bump invalidate the memo
  const entries = useMemo(() => loadHistory(), [revision, bump]);

  if (!entries.length) return null;
  const visible = showAll ? entries : entries.slice(0, PREVIEW_COUNT);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="speed-history"
          className="h-9 text-sm font-medium text-ash hover:text-signal transition-colors cursor-pointer"
        >
          History ({entries.length}) {open ? '▾' : '▸'}
        </button>
        {open && (
          <button
            onClick={() => {
              clearHistory();
              setBump((b) => b + 1);
            }}
            className="h-8 border border-graphite px-3 text-xs text-ash hover:text-signal transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div id="speed-history" className="mt-2 border border-graphite/60 bg-carbon">
          <table className="w-full table-fixed text-xs tabular-nums">
            <caption className="sr-only">Recent speed tests. Download and upload are in Mbps; ping is in milliseconds.</caption>
            <thead>
              <tr className="text-ash border-b border-graphite/60">
                <th scope="col" className="px-2 py-2 text-start font-normal sm:px-4">Time</th>
                <th scope="col" className="px-2 py-2 text-end font-normal sm:px-4">Download<span className="block text-[10px]">Mbps</span></th>
                <th scope="col" className="px-2 py-2 text-end font-normal sm:px-4">Upload<span className="block text-[10px]">Mbps</span></th>
                <th scope="col" className="px-2 py-2 text-end font-normal sm:px-4">Ping<span className="block text-[10px]">ms</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.t} className="border-b border-graphite/30 last:border-b-0">
                  <td className="px-2 py-2 sm:px-4">
                    <time dateTime={new Date(e.t).toISOString()} className="whitespace-nowrap">
                      {timeFmt.format(e.t)}
                      <span className="block text-[10px] text-ash">{dateFmt.format(e.t)}</span>
                    </time>
                  </td>
                  <td className="px-2 py-2 text-end text-down sm:px-4">{speedFmt.format(e.d)}</td>
                  <td className="px-2 py-2 text-end text-up sm:px-4">{speedFmt.format(e.u)}</td>
                  <td className="px-2 py-2 text-end text-ash sm:px-4">{Math.round(e.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > PREVIEW_COUNT && (
            <div className="border-t border-graphite/60 px-2 py-2 sm:px-4">
              <button onClick={() => setShowAll((value) => !value)} className="min-h-8 text-xs text-ash underline underline-offset-4 hover:text-signal">
                {showAll ? `Show latest ${PREVIEW_COUNT}` : `Show all ${entries.length} runs`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
