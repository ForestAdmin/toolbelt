import and from '../../../../src/utils/handlebars/helpers/and';

describe('helpers > and', () => {
  describe('when both of the values are not defined', () => {
    it('should return false', () => {
      expect.assertions(2);

      expect(and(undefined, undefined)).toBe(false);
      expect(and(null, null)).toBe(false);
    });
  });

  describe('when one of the values is not defined', () => {
    it('should return false', () => {
      expect.assertions(4);

      expect(and(undefined, 'defined')).toBe(false);
      expect(and(null, 'defined')).toBe(false);
      expect(and('defined', undefined)).toBe(false);
      expect(and('defined', null)).toBe(false);
    });
  });

  describe('when both of the values are defined', () => {
    it('should compute the correct boolean value', () => {
      expect.assertions(5);

      expect(and(true, false)).toBe(false);
      expect(and(false, false)).toBe(false);
      expect(and(true, true)).toBe(true);
      expect(and(1, true)).toBe(true);
      expect(and('1', true)).toBe(true);
    });
  });
});
