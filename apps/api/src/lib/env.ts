const DEFAULT_PORT = 8787;

export function resolvePort(rawPort: string | undefined = process.env['PORT']): number {
  if (rawPort === undefined || rawPort.trim() === '') {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return parsedPort;
}
