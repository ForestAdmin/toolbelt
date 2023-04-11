import capitalise from '../../../../src/utils/handlebars/helpers/capitalise';

describe('helpers > capitalise', () => {
  describe('when the value is undefined', () => {
    it('should return null', () => {
      expect.assertions(1);

      expect(capitalise(undefined)).toBeNull();
    });
  });

  describe('when the value is empty', () => {
    it('should return empty', () => {
      expect.assertions(1);

      expect(capitalise('')).toBe('');
    });
  });

  describe('when the value is a one character string', () => {
    it('should uppercase the single character', () => {
      expect.assertions(1);

      expect(capitalise('a')).toBe('A');
    });
  });

  describe('when the value is a more then one character string', () => {
    it('should uppercase the first character', () => {
      expect.assertions(1);

      expect(capitalise('long-string')).toBe('Long-string');
    });
  });
});
