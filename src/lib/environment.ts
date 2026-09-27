import { isLocalHost } from './host';

export function isLocalPreview(): boolean {
  return isLocalHost(location.hostname);
}

export const LIVE_TEST_URL = 'https://fast.temidayo.xyz/';
