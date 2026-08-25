// Generates incompressible download-test blobs. Deterministic seeded
// pseudo-random (xorshift32) instead of crypto.randomBytes: still garbage
// to every compression layer, but byte-identical across runs — so wrangler's
// content-hash dedupe means repeat deploys upload zero blob bytes.
import { mkdirSync, writeFileSync } from 'node:fs';

const COUNT = 6;
const SIZE = 24 * 1024 * 1024; // under the 25 MiB per-file static-asset cap

function xorshift32(seed) {
  let s = seed | 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
}

const dir = new URL('../public/blobs/', import.meta.url);
mkdirSync(dir, { recursive: true });

for (let i = 0; i < COUNT; i++) {
  const next = xorshift32(0x9e3779b9 ^ (i + 1));
  const words = new Uint32Array(SIZE / 4);
  for (let j = 0; j < words.length; j++) words[j] = next();
  writeFileSync(new URL(`blob-${i}.bin`, dir), Buffer.from(words.buffer));
}

console.log(`generated ${COUNT} x ${SIZE} deterministic bytes in public/blobs/`);
