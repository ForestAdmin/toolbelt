const { ObjectId } = require('mongodb');
const { getMongooseTypeFromValue, isOfMongooseType } = require('../../src/utils/mongo-primitive-type');

describe('utils > Mongo Primitive Type', () => {
  describe('get primitive type from value', () => {
    it('should return `String`', () => {
      expect.assertions(1);
      expect(getMongooseTypeFromValue('string')).toBe('String');
    });

    it('should return `Number`', () => {
      expect.assertions(1);
      expect(getMongooseTypeFromValue(1)).toBe('Number');
    });

    it('should return `Boolean`', () => {
      expect.assertions(2);
      expect(getMongooseTypeFromValue(true)).toBe('Boolean');
      expect(getMongooseTypeFromValue(false)).toBe('Boolean');
    });

    it('should return `Date`', () => {
      expect.assertions(1);
      expect(getMongooseTypeFromValue(new Date())).toBe('Date');
    });

    it('should return `Mongoose.Schema.Types.ObjectId`', () => {
      expect.assertions(1);
      expect(getMongooseTypeFromValue(new ObjectId('objectIdFake'))).toBe('Mongoose.Schema.Types.ObjectId');
    });

    it('should return null', () => {
      expect.assertions(4);
      expect(getMongooseTypeFromValue(null)).toBeNull();
      expect(getMongooseTypeFromValue(undefined)).toBeNull();
      expect(getMongooseTypeFromValue([])).toBeNull();
      expect(getMongooseTypeFromValue({})).toBeNull();
    });
  });

  describe('checking if value is has a primitive type', () => {
    it('should return true', () => {
      expect.assertions(5);
      expect(isOfMongooseType('string')).toBe(true);
      expect(isOfMongooseType(1)).toBe(true);
      expect(isOfMongooseType(true)).toBe(true);
      expect(isOfMongooseType(new Date())).toBe(true);
      expect(isOfMongooseType(new ObjectId('objectIdFake'))).toBe(true);
    });

    it('should return false', () => {
      expect.assertions(4);
      expect(isOfMongooseType(undefined)).toBe(false);
      expect(isOfMongooseType(null)).toBe(false);
      expect(isOfMongooseType([])).toBe(false);
      expect(isOfMongooseType({})).toBe(false);
    });
  });
});
