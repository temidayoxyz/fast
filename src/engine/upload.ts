// Upload measurement: repeated random-blob POSTs with native XHR upload
// progress. The browser reports bytes sent, and the worker confirms each
// completed request's byte count.

import { isAbortErr } from './stats';
import { publicPreview, uploadUrl } from '../lib/test-target';

const MAX_FAILURES = 3;

const PAYLOAD_SIZE = 2 << 20; // short requests can finish cleanly when sampling ends

export interface ByteCounter {
  /** Cumulative bytes reported by browser upload progress. */
  total(): number;
}

export interface UploadRun {
  promise: Promise<void>;
  counter: ByteCounter;
  stop: () => void;
}

function randomPayload(size: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(size));
  for (let off = 0; off < size; off += 65536) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, size)));
  }
  return buf;
}

/** Concurrent fixed-size blob POSTs with actual browser upload progress. */
export function startUploadBlob(opts: {
  signal: AbortSignal;
}): UploadRun {
  const payload = new Blob([randomPayload(PAYLOAD_SIZE)], {
    type: 'application/octet-stream',
  });

  interface Job {
    loaded: number;
  }
  const jobs = new Set<Job>();
  let transferred = 0;
  let stopping = false;

  const post = (): Promise<void> => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const job: Job = { loaded: 0 };
    jobs.add(job);
    let settled = false;

    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      opts.signal.removeEventListener('abort', onAbort);
      transferred += job.loaded;
      jobs.delete(job);
      if (err) reject(err);
      else resolve();
    };
    const onAbort = (): void => xhr.abort();

    xhr.upload.onprogress = (event) => {
      job.loaded = Math.min(PAYLOAD_SIZE, event.loaded);
    };
    xhr.onerror = () => finish(new Error('Network error during upload'));
    xhr.ontimeout = () => finish(new Error('Upload timed out'));
    xhr.onabort = () => finish(new DOMException('Upload aborted', 'AbortError'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(new Error(`Upload returned HTTP ${xhr.status}`));
        return;
      }
      try {
        if (!publicPreview) {
          const body = JSON.parse(xhr.responseText) as { bytes?: unknown };
          if (body.bytes !== PAYLOAD_SIZE) throw new Error('Upload byte count mismatch');
        }
        job.loaded = PAYLOAD_SIZE;
        finish();
      } catch (err) {
        finish(err instanceof Error ? err : new Error('Invalid upload response'));
      }
    };

    if (opts.signal.aborted) {
      finish(new DOMException('Upload aborted', 'AbortError'));
      return;
    }
    opts.signal.addEventListener('abort', onAbort, { once: true });
    try {
      xhr.open('POST', uploadUrl());
      xhr.timeout = 20000;
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      xhr.send(payload);
    } catch (err) {
      finish(err instanceof Error ? err : new Error('Unable to start upload'));
    }
  });

  const worker = async (): Promise<void> => {
    let failures = 0;
    while (!opts.signal.aborted && !stopping) {
      try {
        await post();
      } catch (err) {
        if (opts.signal.aborted || isAbortErr(err)) throw err;
        if (++failures > MAX_FAILURES) throw err;
        await new Promise((r) => setTimeout(r, 250 * failures));
        continue;
      }
      failures = 0;
    }
  };

  return {
    promise: worker(),
    stop: () => { stopping = true; },
    counter: {
      total: () => transferred + [...jobs].reduce((sum, job) => sum + job.loaded, 0),
    },
  };
}
