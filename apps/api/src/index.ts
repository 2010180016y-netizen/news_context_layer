import type { Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { resolvePort } from './lib/env.js';
import { createServer } from './server.js';

export async function startApiServer(port: number = resolvePort()): Promise<{ port: number; server: Server }> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve();
    });
  });

  console.info(`[api] listening on http://127.0.0.1:${port}`);

  return {
    port,
    server,
  };
}

function isDirectExecution(metaUrl: string): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && metaUrl === pathToFileURL(entryPath).href;
}

if (isDirectExecution(import.meta.url)) {
  void startApiServer();
}
