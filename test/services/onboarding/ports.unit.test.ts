import net from 'net';

import { firstFreePort, parsePort } from '../../../src/services/onboarding/ports';

describe('ports', () => {
  describe('parsePort', () => {
    it('reads a TCP port, and nothing outside the range', () => {
      expect.assertions(5);

      expect(parsePort('3400')).toBe(3400);
      expect(parsePort('65535')).toBe(65535);
      expect(parsePort('65536')).toBeUndefined();
      expect(parsePort('0')).toBeUndefined();
      expect(parsePort('abc')).toBeUndefined();
    });
  });

  describe('firstFreePort', () => {
    it('stops at the end of the port range rather than letting listen throw', async () => {
      expect.assertions(1);

      await expect(firstFreePort(65536)).resolves.toBeUndefined();
    });

    it('skips a port something holds', async () => {
      expect.assertions(1);
      const holder = net.createServer();
      await new Promise<void>(resolve => {
        holder.listen(0, resolve);
      });
      const { port } = holder.address() as net.AddressInfo;

      try {
        await expect(firstFreePort(port)).resolves.toBeGreaterThan(port);
      } finally {
        holder.close();
      }
    });
  });
});
