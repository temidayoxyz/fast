import { isLocalPreview } from './environment';

/** Local development must measure the internet, never loopback assets. */
export const publicPreview = isLocalPreview();

const CLOUDFLARE_TEST = 'https://speed.cloudflare.com';

export function latencyUrl(): string {
  return publicPreview
    ? `${CLOUDFLARE_TEST}/__down?bytes=0&t=${Math.random()}`
    : `/api/latency?t=${Math.random()}`;
}

export function downloadUrl(): string {
  return publicPreview
    ? `${CLOUDFLARE_TEST}/__down?bytes=25165824&t=${Math.random()}`
    : '/blobs/blob-0.bin';
}

export function uploadUrl(): string {
  return publicPreview ? `${CLOUDFLARE_TEST}/__up` : '/api/upload';
}
