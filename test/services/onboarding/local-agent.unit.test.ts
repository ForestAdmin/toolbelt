import { EventEmitter } from 'events';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

import {
  localAgentUrl,
  portTaken,
  readProjectEnv,
  untilStopped,
} from '../../../src/services/onboarding/local-agent';

describe('the local agent', () => {
  it("reads the project's .env, quotes and comments aside, and nothing outside a project", () => {
    expect.assertions(2);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-agent-'));
    fs.writeFileSync(
      path.join(dir, '.env'),
      '# secrets\nFOREST_ENV_SECRET="abc"\nAPPLICATION_PORT=3311\n',
    );

    expect(readProjectEnv(dir)).toStrictEqual({
      FOREST_ENV_SECRET: 'abc',
      APPLICATION_PORT: '3311',
    });
    expect(readProjectEnv(fs.mkdtempSync(path.join(os.tmpdir(), 'local-agent-')))).toStrictEqual(
      {},
    );
  });

  it('finds the agent on its APPLICATION_PORT, 3310 by default', () => {
    expect.assertions(2);
    expect(localAgentUrl({ APPLICATION_PORT: '3311' })).toBe('http://localhost:3311');
    expect(localAgentUrl({})).toBe('http://localhost:3310');
  });

  it('stops the children on Ctrl+C before any SIGINT listener registered earlier', async () => {
    expect.assertions(1);
    const order: string[] = [];
    // Stands for the spinner library's listener, which exits the process.
    const earlier = () => order.push('earlier listener');
    process.on('SIGINT', earlier);
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });

    try {
      const stopped = untilStopped([child as never], () => order.push('stop'));
      process.emit('SIGINT', 'SIGINT');
      await stopped;

      expect(order).toStrictEqual(['stop', 'earlier listener']);
    } finally {
      process.removeListener('SIGINT', earlier);
    }
  });

  it('sees a port taken by anything listening, and free once it stops', async () => {
    expect.assertions(2);
    const server = net.createServer(socket => socket.destroy());
    await new Promise<void>(resolve => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as net.AddressInfo;

    await expect(portTaken(port)).resolves.toBe(true);
    await new Promise(resolve => {
      server.close(resolve);
    });
    await expect(portTaken(port)).resolves.toBe(false);
  });

  it('stops the others as soon as one child ends', async () => {
    expect.assertions(1);
    const tunnel = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const server = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const stop = jest.fn();

    const stopped = untilStopped([tunnel as never, server as never], stop);
    server.exitCode = 1 as never;
    server.emit('exit');
    await stopped;

    expect(stop).toHaveBeenCalledWith();
  });

  it('does not wait for a child that ended before the wait began', async () => {
    expect.assertions(1);
    const ended = Object.assign(new EventEmitter(), { exitCode: 1, signalCode: null });
    const stop = jest.fn();

    await untilStopped([ended as never], stop);

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
