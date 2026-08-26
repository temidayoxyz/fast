import { useMemo, useState } from 'react';
import { clearHistory, loadHistory } from '../lib/history';
import { fmtAuto } from '../lib/units';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function HistoryTable({ revision }: { revision: number }) {
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revision/bump invalidate the memo
  const entries = useMemo(() => loadHistory(), [revision, bump]);

  if (!entries.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-[10px] tracking-[0.22em] text-ash hover:text-signal transition-colors cursor-pointer"
        >
          HISTORY ({entries.length}) {open ? '▾' : '▸'}
        </button>
        {open && (
          <button
            onClick={() => {
              clearHistory();
              setBump((b) => b + 1);
            }}
            className="text-[10px] tracking-[0.22em] text-graphite hover:text-ash transition-colors cursor-pointer"
          >
            CLEAR
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 border border-graphite/60 overflow-x-auto bg-carbon">
          <table className="w-full text-[11px] tabular-nums whitespace-nowrap">
            <thead>
              <tr className="text-ash text-left border-b border-graphite/60">
                {['TIME', 'DOWN', 'UP', 'PING', 'GRADE', 'POP'].map((hLabel) => (
                  <th key={hLabel} className="px-3 py-2 font-normal tracking-[0.14em]">
                    {hLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.t} className="border-b border-graphite/30 last:border-b-0">
                  <td className="px-3 py-1.5 text-ash">{timeFmt.format(e.t)}</td>
                  <td className="px-3 py-1.5">{fmtAuto(e.d)}</td>
                  <td className="px-3 py-1.5 text-ash">{fmtAuto(e.u)}</td>
                  <td className="px-3 py-1.5 text-ash">{e.p.toFixed(1)}</td>
                  <td className="px-3 py-1.5">{e.g}</td>
                  <td className="px-3 py-1.5 text-ash">{e.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
