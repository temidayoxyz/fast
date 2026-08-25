import type { Phase } from '../engine/engine';

const STREAM_OPTIONS = [1, 3, 6] as const;

const ACTION_LABEL: Partial<Record<Phase, string>> = {
  idle: 'START',
  latency: 'ABORT',
  download: 'ABORT',
  upload: 'ABORT',
  done: 'RUN AGAIN',
  aborted: 'RUN AGAIN',
};

export function Controls(props: {
  streams: number;
  onStreams: (n: number) => void;
  running: boolean;
  phase: Phase;
  onStart: () => void;
  onAbort: () => void;
}) {
  const label = ACTION_LABEL[props.phase] ?? 'START';
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 justify-center sm:justify-start">
        <span className="text-[10px] tracking-[0.22em] text-ash">STREAMS</span>
        <div
          role="group"
          aria-label="parallel connections"
          className={`flex border border-graphite transition-opacity ${
            props.running ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {STREAM_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => props.onStreams(n)}
              aria-pressed={props.streams === n}
              className={`w-11 h-9 text-xs tabular-nums cursor-pointer transition-colors ${
                props.streams === n
                  ? 'bg-signal text-void font-semibold'
                  : 'text-ash hover:text-signal'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={props.running ? props.onAbort : props.onStart}
        className={`h-11 px-10 text-xs tracking-[0.26em] font-medium cursor-pointer transition-colors border ${
          props.running
            ? 'border-signal text-signal bg-transparent hover:bg-carbon'
            : 'bg-signal text-void border-transparent hover:bg-white'
        }`}
      >
        {label}
      </button>
    </div>
  );
}
