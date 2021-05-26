const ApplicationContext = require('@forestadmin/context');
const initContext = require('../../src/context/init');

describe('context > init', () => {
  it('should not throw error with an empty context', () => {
    expect.assertions(1);

    expect(() => initContext(new ApplicationContext())).not.toThrow();
  });
});
