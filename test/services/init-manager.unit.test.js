const { validateEndpoint } = require('../../src/services/init-manager');

describe('services > init-manager', () => {
  describe('validateEndpoint', () => {
    it('should return true with a proper HTTPs URL', () => {
      expect.assertions(1);

      expect(validateEndpoint('https://domain.com')).toBe(true);
    });

    it('should return an error message with invalid URL', () => {
      expect.assertions(1);

      expect(validateEndpoint('xx/yy')).toBe('Application input must be a valid url.');
    });

    it('should return an error message with a non HTTPs URL', () => {
      expect.assertions(1);

      expect(validateEndpoint('http://domain.com')).toBe(
        'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.',
      );
    });

    it('should allow HTTP on localhost', () => {
      expect.assertions(1);

      expect(validateEndpoint('http://localhost')).toBe(true);
    });

    it('should allow HTTP on 127.0.0.1', () => {
      expect.assertions(1);

      expect(validateEndpoint('http://127.0.0.1')).toBe(true);
    });
  });
});
