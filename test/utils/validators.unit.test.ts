import {
  validateAppHostname,
  validateDbName,
  validateOrganizationId,
  validatePort,
} from '../../src/utils/validators';

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
    it('should return true if db name is valid', () => {
      expect.assertions(1);
      expect(validateAppHostname('test')).toBe(true);
    });

    it('should return error message if db name is not valid', () => {
      expect.assertions(1);
      expect(validateAppHostname('')).toBe('Please specify the application hostname.');
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

  describe('validateOrganizationId', () => {
    it.each(['1', '42', '1234567'])('should accept the positive integer %s', id => {
      expect.assertions(1);
      expect(validateOrganizationId(id)).toBe(true);
    });

    it.each(['', '0', '-1', '01', '1.5', '1e3', 'abc', ' 42', '42abc', '99999999999'])(
      'should refuse %j',
      id => {
        expect.assertions(1);
        expect(validateOrganizationId(id)).toBe(
          'The organization must be a positive integer id, like 42.',
        );
      },
    );
  });
});
