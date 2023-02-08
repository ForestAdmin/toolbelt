const { isUnderscored } = require('../../src/utils/fields');

describe('utils > fields', () => {
  describe('without wrong parameters', () => {
    it('should return false', () => {
      expect.assertions(2);

      expect(isUnderscored(undefined)).toBe(false);
      expect(isUnderscored([])).toBe(false);
    });
  });

  describe('with only one field named `id`', () => {
    it('should return true', () => {
      expect.assertions(1);

      const fields = [
        {
          nameColumn: 'id',
        },
      ];

      expect(isUnderscored(fields)).toBe(true);
    });
  });

  describe('with multiple fields', () => {
    describe('with underscored fields', () => {
      it('should return true', () => {
        expect.assertions(1);

        const fields = [
          {
            nameColumn: 'id',
          },
          {
            nameColumn: 'first_name',
          },
        ];

        expect(isUnderscored(fields)).toBe(true);
      });
    });

    describe('without underscored fields', () => {
      it('should return false', () => {
        expect.assertions(1);

        const fields = [
          {
            nameColumn: 'id',
          },
          {
            nameColumn: 'firstName',
          },
        ];

        expect(isUnderscored(fields)).toBe(false);
      });
    });
  });
});
