import { validateAppHostname, validateDbName, validatePort } from '../../src/utils/validators';

describe('validator', () => {
  describe('validatePort', () => {
    it('should return true if port is valid', () => {
      expect.assertions(1);
      expect(validatePort('3000')).toBe(true);
    });

    it('should return error message if port is not a number', () => {
      expect.assertions(1);
      expect(validatePort('abc')).toBe('The port must be a number.');
    });

    it('should return error message if port is not in range', () => {
      expect.assertions(1);
      expect(validatePort('65536')).toBe('This is not a valid port.');
    });
  });

  describe('validateAppHostname', () => {
    it('should return true if hostname is valid', () => {
      expect.assertions(1);
      expect(validateAppHostname('https://localhost')).toBe(true);
    });

    it('should return error message if hostname is not a valid url', () => {
      expect.assertions(1);
      expect(validateAppHostname('abc')).toBe('Application hostname must be a valid url.');
    });

    it('should return error message if hostname is remote and http', () => {
      expect.assertions(1);
      expect(validateAppHostname('http://host.com')).toBe(
        'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.',
      );
    });
  });

  describe('validateDbName', () => {
    it('should return true if db name is valid', () => {
      expect.assertions(1);
      expect(validateDbName('test')).toBe(true);
    });

    it('should return error message if db name is not valid', () => {
      expect.assertions(1);
      expect(validateDbName('')).toBe('Please specify the database name.');
    });
  });
});
