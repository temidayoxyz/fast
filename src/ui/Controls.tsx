import type { Phase } from '../engine/engine';

const ACTION_LABEL: Partial<Record<Phase, string>> = {
  idle: 'START TEST',
  latency: 'STOP TEST',
  download: 'STOP TEST',
  upload: 'STOP TEST',
  done: 'RUN AGAIN',
  aborted: 'RUN AGAIN',
};

export function Controls(props: {
  running: boolean;
  phase: Phase;
  onStart: () => void;
  onAbort: () => void;
}) {
  const label = ACTION_LABEL[props.phase] ?? 'START';
  return (
    <div>
      <button
        onClick={props.running ? props.onAbort : props.onStart}
        className={`h-11 w-full min-w-36 px-6 text-xs tracking-[0.12em] font-semibold cursor-pointer transition-colors border lg:w-auto ${
          props.running
            ? 'border-signal text-signal bg-transparent hover:bg-panel'
            : 'bg-signal text-void border-transparent hover:bg-white'
        }`}
      >
        {label}
      </button>
    </div>
  );
}
