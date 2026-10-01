import net from 'net';

function canListen(port: number, host?: string): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

/**
 * Whether a server could bind `port` now. Both binds are tried: Node's default (every interface,
 * which is what the embedded executor uses) and loopback, which another tool may hold on its own.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (await canListen(port)) && canListen(port, '127.0.0.1');
}

/** The first port from `from` that nothing holds, or undefined after `attempts` tries. */
export async function firstFreePort(from: number, attempts = 50): Promise<number | undefined> {
  for (let port = from; port < from + attempts; port += 1) {
    // eslint-disable-next-line no-await-in-loop -- probed one at a time, lowest first
    if (await isPortFree(port)) return port;
  }

  return undefined;
}
