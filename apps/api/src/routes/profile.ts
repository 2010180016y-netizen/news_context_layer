import type { IncomingMessage } from 'node:http';

import type { FileNewsContextStore } from '../repositories/file-store.js';
import { parseDeviceIdentity } from './watchlists.js';

export async function getProfileForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore
) {
  const identity = parseDeviceIdentity(request);
  return store.getProfile(identity);
}
