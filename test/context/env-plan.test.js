const Context = require('@forestadmin/context');
const contextPlan = require('../../src/context/plan');

describe('context > env', () => {
  it('keeps the raw FOREST_SERVER_URL beside the one FOREST_URL overrides', () => {
    expect.assertions(3);
    const saved = process.env;
    process.env = {
      ...saved,
      FOREST_URL: 'https://api.development.forestadmin.com',
      FOREST_SERVER_URL: 'https://api.forestadmin.com',
    };

    try {
      const { env } = Context.execute(contextPlan);

      expect(env.FOREST_SERVER_URL).toBe('https://api.development.forestadmin.com');
      expect(env.RAW_FOREST_SERVER_URL).toBe('https://api.forestadmin.com');
      expect(env.FOREST_SERVER_URL_SOURCE).toBe('FOREST_URL');
    } finally {
      process.env = saved;
    }
  });

  it.each([
    [{ RACK_ENV: 'staging' }, 'staging'],
    [{ RAILS_ENV: 'test', RACK_ENV: 'staging' }, 'test'],
  ])('reads the rails env from %j', (railsEnv, expected) => {
    expect.assertions(1);
    const saved = process.env;
    process.env = { ...saved, RAILS_ENV: undefined, RACK_ENV: undefined, ...railsEnv };

    try {
      expect(Context.execute(contextPlan).env.RAILS_ENV).toBe(expected);
    } finally {
      process.env = saved;
    }
  });
});
