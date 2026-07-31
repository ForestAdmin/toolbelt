const testCli = require('../../test-cli-helper/test-cli');
const InAppCommand = require('../../../../src/commands/projects/create/in-app').default;
const { testEnvWithSecret } = require('../../../fixtures/env');
const { createProject, updateNewEnvironmentEndpoint } = require('../../../fixtures/api');

// Secrets coming from the fixtures: the env secret is the `secretKey` served by
// `createProject`, the auth secret comes from the mocked keyGenerator below.
const ENV_SECRET = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
const AUTH_SECRET = 'myAuthSecret';

// Only host + port are prompted (no `language`: nothing is scaffolded).
const expectedPrompts = [
  {
    name: 'applicationHost',
    message: "What's the IP/hostname on which your application will be running?",
    type: 'input',
    default: 'http://localhost',
    validate: expect.any(Function),
  },
  {
    name: 'applicationPort',
    message: "What's the port on which your application is running?",
    type: 'input',
    // In-app default is 3000 (the user's own app), NOT the 3310 of scaffolded agents.
    default: '3000',
    validate: expect.any(Function),
  },
];

// The whole point of the command: the creation POST must contain exactly
// `"agent":null` + `"architecture":"in-app"` (unlike every other create:*).
// The nock body matching in `createProject` is the guard-rail here: the server
// silently forces architecture=microservice whenever a non-null agent is sent,
// so if the command ever sent an agent, the mock would not match and the test
// would fail on the unmatched request.
const api = [
  () => createProject({ databaseType: null, agent: null, architecture: 'in-app' }),
  () => updateNewEnvironmentEndpoint('http://localhost:3000'),
];

describe('projects:create:in-app', () => {
  describe('execution', () => {
    it('should register an in-app project (no agent, no DB, no scaffold) and print the secrets + guidance', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name'],
        env: testEnvWithSecret,
        token: 'any',
        additionnalStep: plan =>
          plan.replace('utils/keyGenerator', { generate: () => AUTH_SECRET }),
        prompts: [
          {
            in: expectedPrompts,
            out: { applicationHost: 'http://localhost', applicationPort: '3000' },
          },
        ],
        api,
        std: [
          { spinner: '√ Creating your project on Forest Admin' },
          { out: '> Hooray, installation success!' },
          { out: 'In-app project created — no code was scaffolded.' },
          // Full values (not just the prefixes): `undefined` must not slip through.
          { out: `FOREST_ENV_SECRET=${ENV_SECRET}` },
          { out: `FOREST_AUTH_SECRET=${AUTH_SECRET}` },
          // The 5 Rails gems must be listed (forest_admin_rails alone does not boot).
          { out: 'forest_admin_datasource_active_record' },
          { out: 'npm install @forestadmin/agent' },
          // No DB is ever touched: requiresDatabase = false and nothing is scaffolded.
          { not: 'Testing connection' },
          { not: 'Analyzing' },
          { not: 'Creating your project files' },
        ],
        exitCode: 0,
      }));

    it('should print ONLY a parsable JSON document on stdout with --format json', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json'],
        env: testEnvWithSecret,
        token: 'any',
        additionnalStep: plan =>
          plan.replace('utils/keyGenerator', { generate: () => AUTH_SECRET }),
        prompts: [
          {
            in: expectedPrompts,
            out: { applicationHost: 'http://localhost', applicationPort: '3000' },
          },
        ],
        api,
        std: [
          // Progress still goes to stderr; stdout stays machine-readable.
          { spinner: '√ Creating your project on Forest Admin' },
          // An object entry makes the helper JSON.parse the WHOLE stdout and
          // strict-compare it: this is the `npx forest-start` contract — pure
          // JSON, no logger prefix, no trailing annotation.
          {
            out: {
              projectId: 4242,
              envSecret: ENV_SECRET,
              authSecret: AUTH_SECRET,
            },
          },
          { not: 'Testing connection' },
          { not: 'Analyzing' },
          { not: 'Hooray' },
        ],
        exitCode: 0,
      }));
  });
});
