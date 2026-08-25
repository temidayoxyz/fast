// Upload measurement — dual mode:
//
//  A) blob POST (all browsers): K workers looping fixed-size random-blob
//     POSTs. Bytes are attributed linearly across each POST's lifetime so
//     the live curve is smooth; attribution is exact in aggregate because
//     every byte is eventually credited.
//  B) streaming POST (Chromium): fetch(duplex:'half') with a pull-based
//     ReadableStream — backpressure makes `pull` fire at socket-drain rate,
//     giving a native high-resolution sent-bytes signal.
//
// Feature detection follows the documented Chromium idiom: a real
// implementation reads `duplex` and refuses to infer Content-Type from a
// stream body; pretenders never touch the accessor.

import { mean } from './stats';

const STREAM_CHUNK = 1 << 20; // 1 MiB per streamed chunk
const PAYLOAD_SIZE = 16 << 20; // 16 MiB per blob POST (under the 100 MB cap)

export interface ByteCounter {
  /** cumulative attributed bytes at time `nowMs` (performance.now clock) */
  total(nowMs: number): number;
}

export interface UploadRun {
  promise: Promise<void>;
  counter: ByteCounter;
}

export function supportsStreamingUpload(): boolean {
  try {
    let duplexSeen = false;
    const req = new Request('', {
      method: 'POST',
      body: new ReadableStream(),
      get duplex() {
        duplexSeen = true;
        return 'half';
      },
    } as RequestInit);
    return duplexSeen && !req.headers.has('content-type');
  } catch {
    return false;
  }
}

function randomPayload(size: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(size));
  for (let off = 0; off < size; off += 65536) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, size)));
  }
  return buf;
}

/** Mode B — Chromium streaming POST. */
export function startUploadStreaming(opts: {
  streams: number;
  signal: AbortSignal;
}): UploadRun {
  let sent = 0;
  const tpl = randomPayload(STREAM_CHUNK);

  const makeBody = () =>
    new ReadableStream<Uint8Array>({
      pull(ctrl) {
        if (opts.signal.aborted) {
          ctrl.close();
          return;
        }
        ctrl.enqueue(tpl.slice());
        sent += STREAM_CHUNK;
      },
    });

  const worker = async (): Promise<void> => {
    while (!opts.signal.aborted) {
      await fetch('/api/upload', {
        method: 'POST',
        body: makeBody(),
        duplex: 'half',
        signal: opts.signal,
        headers: { 'content-type': 'application/octet-stream' },
      } as RequestInit);
    }
  };

  return {
    promise: Promise.all(Array.from({ length: opts.streams }, () => worker())).then(),
    counter: { total: () => sent },
  };
}

/** Mode A — concurrent fixed-size blob POSTs, works everywhere. */
export function startUploadBlob(opts: {
  streams: number;
  signal: AbortSignal;
}): UploadRun {
  const payload = new Blob([randomPayload(PAYLOAD_SIZE)], {
    type: 'application/octet-stream',
  });

  interface Job {
    start: number;
    done: boolean;
  }
  const jobs: Job[] = [];
  const rates: number[] = [];
  // Pre-first-completion attribution guess; the warm-up discard hides it.
  let rate = PAYLOAD_SIZE / 1500;

  const worker = async (): Promise<void> => {
    while (!opts.signal.aborted) {
      const job: Job = { start: performance.now(), done: false };
      jobs.push(job);
      await fetch('/api/upload', {
        method: 'POST',
        body: payload,
        signal: opts.signal,
        cache: 'no-store',
        headers: { 'content-type': 'application/octet-stream' },
      });
      job.done = true;
      rates.push(PAYLOAD_SIZE / (performance.now() - job.start));
      rate = mean(rates);
    }
  };

  return {
    promise: Promise.all(Array.from({ length: opts.streams }, () => worker())).then(),
    counter: {
      total(nowMs: number): number {
        let t = 0;
        for (const j of jobs) {
          t += j.done
            ? PAYLOAD_SIZE
            : Math.min(PAYLOAD_SIZE, Math.max(0, nowMs - j.start) * rate);
        }
        return t;
      },
    },
  };
}
