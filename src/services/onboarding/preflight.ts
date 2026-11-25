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
 * Whether nothing listens on this port on this machine. Both ways an agent can hold it: on every
 * interface, as Node listens by default (`::` on macOS, which 127.0.0.1 alone does not see), and
 * on the loopback only.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (await canListen(port)) && canListen(port, '127.0.0.1');
}

export function nodeMajor(): number {
  return Number(process.versions.node.split('.')[0]);
}

export const MIN_NODE_MAJOR = 18;
