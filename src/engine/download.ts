// Download measurement: N parallel streams pulling random-byte blobs,
// counting wire bytes via ReadableStream. Runs until aborted — the engine's
// ticker decides when the stability rule has been satisfied.

const BLOB_COUNT = 6; // matches scripts/generate-blobs.mjs

export async function runDownload(opts: {
  streams: number;
  signal: AbortSignal;
  onBytes: (delta: number) => void;
}): Promise<void> {
  const worker = async (i: number): Promise<void> => {
    // One dedicated file per stream so parallel connections never share a URL.
    const url = `/blobs/blob-${i % BLOB_COUNT}.bin`;
    while (!opts.signal.aborted) {
      const res = await fetch(url, { cache: 'no-store', signal: opts.signal });
      if (!res.body) throw new Error('EMPTY RESPONSE BODY');
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        opts.onBytes(value.byteLength);
      }
    }
  };

  await Promise.all(Array.from({ length: opts.streams }, (_, i) => worker(i)));
}
