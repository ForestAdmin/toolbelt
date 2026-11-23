import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  localAgentUrl,
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

  it('resolves once every child has exited on its own, without stopping them', async () => {
    expect.assertions(1);
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const stop = jest.fn();

    const stopped = untilStopped([child as never], stop);
    child.exitCode = 0 as never;
    child.emit('exit');
    await stopped;

    expect(stop).not.toHaveBeenCalled();
  });
});
