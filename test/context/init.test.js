const Context = require('@forestadmin/context');
const contextPlan = require('../../src/context/init');

describe('context > init', () => {
  it('should not throw error with an empty context', () => {
    expect.assertions(1);

    expect(() => Context.execute(contextPlan)).not.toThrow();
  });
});
