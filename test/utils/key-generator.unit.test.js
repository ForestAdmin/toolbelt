const crypto = require('crypto');
const KeyGenerator = require('../../src/utils/key-generator');

describe('keyGenerator', () => {
  const makeContext = () => ({
    assertPresent: jest.fn(),
    crypto,
  });

  it('generate a string of 48 characters', () => {
    expect.assertions(1);
    const context = makeContext();
    const keyGenerator = new KeyGenerator(context);

    const result = keyGenerator.generate();
    expect(result).toHaveLength(48);
  });
});
