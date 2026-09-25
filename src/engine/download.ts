// Download measurement: one connection pulling a random-byte blob,
// counting wire bytes via ReadableStream. Runs until aborted — the engine's
// ticker decides when the stability rule has been satisfied.
//
// A single stream hiccup must not kill the run: non-abort failures retry
// with backoff; only aborts (intended stops) and exhausted retries propagate.

import { isAbortErr } from './stats';
import { downloadUrl } from '../lib/test-target';

const MAX_FAILURES = 3;

export async function runDownload(opts: {
  signal: AbortSignal;
  onBytes: (delta: number) => void;
}): Promise<void> {
  const worker = async (): Promise<void> => {
    let failures = 0;
    while (!opts.signal.aborted) {
      try {
        const res = await fetch(downloadUrl(), { cache: 'no-store', signal: opts.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          opts.onBytes(value.byteLength);
        }
        failures = 0; // a clean full-blob pass resets the circuit breaker
      } catch (err) {
        if (opts.signal.aborted || isAbortErr(err)) throw err; // intended stop
        if (++failures > MAX_FAILURES) throw err; // genuinely broken line
        await new Promise((r) => setTimeout(r, 250 * failures));
      }
    }
  };

  await worker();
}
