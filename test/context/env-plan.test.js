const Context = require('@forestadmin/context');
const contextPlan = require('../../src/context/plan');

describe('context > env', () => {
  it.each([
    ['https://api.forestadmin.com', undefined, undefined],
    [
      'https://api.development.forestadmin.com',
      undefined,
      'https://app.development.forestadmin.com',
    ],
    [
      'https://API.Development.ForestAdmin.com',
      undefined,
      'https://app.development.forestadmin.com',
    ],
    [
      'https://api.preview-1.forestadmin.com:8443/path',
      undefined,
      'https://app.preview-1.forestadmin.com:8443',
    ],
    ['https://api.development.forestadmin.com', 'http://localhost:4200/', 'http://localhost:4200'],
    ['https://api.forestadmin.com', 'https://app.example.com', 'https://app.example.com'],
    ['https://api.forestadmin.com', 'https://app.example.com/docs\n', 'https://app.example.com'],
    ['https://api.dev.eu.forestadmin.com', undefined, undefined],
    ['https://api.dev.forestadmin.com.example.com', undefined, undefined],
    ['https://api.dev.forestadmin.com.', undefined, undefined],
    ['http://localhost:3001', undefined, undefined],
    ['not a URL', undefined, undefined],
    ['ftp://api.dev.forestadmin.com', undefined, undefined],
    ['https://api.development.forestadmin.com', 'not a URL', undefined],
    ['https://api.development.forestadmin.com', 'ftp://app.example.com', undefined],
    ['https://api.development.forestadmin.com', 'https://user:secret@app.example.com', undefined],
  ])(
    'resolves the app origin for FOREST_URL=%j and FOREST_APP_URL=%j',
    (apiUrl, appUrl, expected) => {
      expect.assertions(1);
      const saved = process.env;
      process.env = {
        ...saved,
        FOREST_URL: apiUrl,
        FOREST_APP_URL: appUrl,
        FOREST_SERVER_URL: 'https://api.other.forestadmin.com',
      };

      try {
        expect(Context.execute(contextPlan).env.FOREST_APP_URL).toBe(expected);
      } finally {
        process.env = saved;
      }
    },
  );

  it.each([
    [undefined, undefined],
    ['https://api.development.forestadmin.com', 'https://app.development.forestadmin.com'],
  ])(
    'derives the app origin from FOREST_SERVER_URL=%j when FOREST_URL is unset',
    (serverUrl, expected) => {
      expect.assertions(1);
      const saved = process.env;
      process.env = {
        ...saved,
        FOREST_URL: undefined,
        FOREST_APP_URL: undefined,
        FOREST_SERVER_URL: serverUrl,
      };

      try {
        expect(Context.execute(contextPlan).env.FOREST_APP_URL).toBe(expected);
      } finally {
        process.env = saved;
      }
    },
  );

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
