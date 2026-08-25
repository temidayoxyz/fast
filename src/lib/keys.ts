import { useEffect } from 'react';

/**
 * Space = start/restart or abort, Esc = abort. Global handler; preventDefault
 * stops page-scroll and native button re-activation, so no double-fires.
 */
export function useGlobalKeys(handlers: {
  onStart: () => void;
  onAbort: () => void;
  isRunning: () => boolean;
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlers.isRunning() ? handlers.onAbort() : handlers.onStart();
      } else if (e.key === 'Escape') {
        handlers.onAbort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
