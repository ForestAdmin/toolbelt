import toInterfaceType from '../../../../src/utils/handlebars/helpers/to-interface-type';

describe('helpers > toInterfaceType', () => {
  describe('when the type is not known', () => {
    it('should return `object`', () => {
      expect.assertions(4);

      expect(toInterfaceType(undefined)).toBe('object');
      expect(toInterfaceType(null)).toBe('object');
      expect(toInterfaceType(true)).toBe('object');
      expect(toInterfaceType('not known')).toBe('object');
    });
  });

  const assertions = [
    {
      type: 'String',
      result: 'string',
    },
    {
      type: 'Number',
      result: 'number',
    },
    {
      type: 'Boolean',
      result: 'boolean',
    },
    {
      type: 'Date',
      result: 'Date',
    },
    {
      type: 'Mongoose.Schema.Types.ObjectId',
      result: 'Mongoose.Types.ObjectId',
    },
    {
      type: 'ambiguous',
      result: 'Mongoose.Types.ObjectId',
    },
    {
      type: '[Mongoose.Schema.Types.ObjectId]',
      result: 'Array<Mongoose.Types.ObjectId>',
    },
  ];

  describe.each(assertions)('when the type is `$type`', assertion => {
    it('should return `$result`', () => {
      expect.assertions(1);

      expect(toInterfaceType(assertion.type)).toBe(assertion.result);
    });
  });
});
