const nock = require('nock');

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

    // The command's whole payload is the pair of secrets, and SILENT drops every
    // logger line: delivering neither would leave a created project whose env secret
    // is reachable only from the Forest UI.
    it('should still hand over the secrets when SILENT drops the guidance', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name'],
        env: { ...testEnvWithSecret, SILENT: '1' },
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
          // The spinner is not a logger line, so SILENT does not reach it.
          { spinner: '√ Creating your project on Forest Admin' },
          { out: `FOREST_ENV_SECRET=${ENV_SECRET}` },
          { out: `FOREST_AUTH_SECRET=${AUTH_SECRET}` },
          // Delivering the secrets without this is worse than not delivering them:
          // SILENT is what a CI run sets, and CI logs are exactly the hazard.
          { out: '⚠ These are secrets' },
          // The guidance around them is what SILENT is for, and it does go quiet.
          { not: 'In-app project created' },
          { not: 'npm install @forestadmin/agent' },
        ],
        exitCode: 0,
      }));

    it('should print ONLY a parsable JSON document on stdout, without ever prompting', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json'],
        env: testEnvWithSecret,
        token: 'any',
        additionnalStep: plan =>
          plan.replace('utils/keyGenerator', { generate: () => AUTH_SECRET }),
        // `prompts: []` is half the assertion: the helper fails if inquirer is called
        // at all. A question would land on stdout and break JSON.parse — and then block
        // forever on an answer no script is there to give. The declared defaults are
        // used instead, which the `http://localhost:3000` endpoint mock below proves.
        prompts: [],
        api,
        std: [
          // Progress still goes to stderr; stdout stays machine-readable.
          { spinner: '√ Creating your project on Forest Admin' },
          // An object entry makes the helper JSON.parse the WHOLE stdout and
          // strict-compare it: this is the `npx forest-start` contract — pure
          // JSON, no logger prefix, no trailing annotation.
          {
            out: {
              projectId: '4242',
              envSecret: ENV_SECRET,
              authSecret: AUTH_SECRET,
              // Built from the silently defaulted host and port, so a caller that
              // never saw a prompt can tell where its panel was pointed.
              endpoint: 'http://localhost:3000',
            },
          },
          // Human-readable lines are not dropped, only diverted: stdout stays
          // parsable AND the operator still sees what happened on stderr.
          { err: 'Hooray, installation success!' },
          { not: 'Testing connection' },
          { not: 'Analyzing' },
        ],
        exitCode: 0,
      }));

    it('should honour explicit host/port over the defaults with --format json', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json', '-H', 'http://localhost', '-P', '8080'],
        env: testEnvWithSecret,
        token: 'any',
        additionnalStep: plan =>
          plan.replace('utils/keyGenerator', { generate: () => AUTH_SECRET }),
        prompts: [],
        api: [
          () => createProject({ databaseType: null, agent: null, architecture: 'in-app' }),
          () => updateNewEnvironmentEndpoint('http://localhost:8080'),
        ],
        std: [
          { spinner: '√ Creating your project on Forest Admin' },
          {
            out: {
              projectId: '4242',
              envSecret: ENV_SECRET,
              authSecret: AUTH_SECRET,
              endpoint: 'http://localhost:8080',
            },
          },
        ],
        exitCode: 0,
      }));

    // A machine-driven run must never be answered with a password prompt.
    it('should refuse --format json when not logged in instead of prompting', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json'],
        env: testEnvWithSecret,
        token: null,
        prompts: [],
        std: [
          { err: "Not logged in. Run 'forest login' before using --format json." },
          // Nothing was written to the machine-readable stream.
          { not: 'envSecret' },
        ],
        exitCode: 10,
      }));

    // JSON.stringify drops undefined keys, so a missing secret would otherwise be
    // emitted as a successful-looking `{"projectId":...}` with exit 0.
    it('should emit nothing rather than a partial document if the secret is missing', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json'],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [],
        api: [
          () => createProject({ databaseType: null, agent: null, architecture: 'in-app' }),
          // The env secret is read from the PUT response, not the POST: reply without it.
          () =>
            nock('http://localhost:3001')
              .put('/api/environments/182')
              .reply(200, { data: { type: 'environments', id: '182', attributes: {} } }),
        ],
        std: [
          { err: 'did not return its environment secret' },
          { not: 'projectId' },
          // Checked before the success path, so no contradictory "success" line.
          { not: 'Hooray' },
          // The project WAS created, so the headline would contradict the line above.
          { not: 'Cannot generate your project.' },
          // The pointer to help survives that suppression, on this path as on any other.
          { err: 'An unexpected error occurred' },
        ],
        exitCode: 1,
      }));

    // The failure mode --format json used to have: a generic line on stderr and the
    // actual cause swallowed with the rest of stdout.
    it('should keep the underlying error visible on stderr with --format json', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json'],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [],
        api: [
          () =>
            nock('http://localhost:3001')
              .post('/api/projects')
              .reply(500, { errors: [{ status: 500, detail: 'boom' }] }),
        ],
        std: [
          { err: 'Cannot generate your project.' },
          { err: 'Internal Server Error' },
          { not: 'envSecret' },
        ],
        exitCode: 1,
      }));
  });

  describe('with --invitation', () => {
    const CLAIM = 'SENTINELclaimAAAAAAAAAAAAAAAAAAAA';

    const refusal = (status, code, detail) => () =>
      nock('http://localhost:3001')
        .post('/api/projects')
        .reply(status, { errors: [{ status, detail, meta: { code } }] });

    const authenticatorWithLogout = logout => plan =>
      plan
        .replace('utils/keyGenerator', { generate: () => AUTH_SECRET })
        .replace('services/authenticator/authenticator', {
          getAuthToken: () => 'any',
          login: () => {},
          logout,
          tryLogin: () => {},
        });

    it('should send the claim in the creation call and never print it', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json', '--invitation', CLAIM],
        env: testEnvWithSecret,
        token: 'any',
        additionnalStep: plan =>
          plan.replace('utils/keyGenerator', { generate: () => AUTH_SECRET }),
        prompts: [],
        api: [
          () =>
            createProject({
              databaseType: null,
              agent: null,
              architecture: 'in-app',
              invitationClaim: CLAIM,
            }),
          () => updateNewEnvironmentEndpoint('http://localhost:3000'),
        ],
        std: [
          {
            out: {
              projectId: '4242',
              envSecret: ENV_SECRET,
              authSecret: AUTH_SECRET,
              endpoint: 'http://localhost:3000',
            },
          },
          { err: 'Hooray, installation success!' },
          { not: CLAIM },
        ],
        exitCode: 0,
      }));

    it('should point to logout then login, without logging out, on a claim for another account', async () => {
      expect.hasAssertions();

      const logout = jest.fn();

      await testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json', '--invitation', CLAIM],
        env: testEnvWithSecret,
        additionnalStep: authenticatorWithLogout(logout),
        prompts: [],
        api: [refusal(403, 'developer_invitation_claim_wrong_account', `Not yours ${CLAIM}`)],
        std: [
          { err: 'Run `forest logout`, then `forest login` with the invited account' },
          { not: 'You do not have the right' },
          { not: 'Please use' },
          { not: 'Not yours' },
          { not: CLAIM },
        ],
        exitCode: 1,
      });

      expect(logout).not.toHaveBeenCalled();
    });

    it.each([
      ['expired', 'This invitation expired.'],
      ['revoked', 'This invitation was revoked.'],
      ['consumed', 'This invitation was already used.'],
      ['invalid', 'This invitation does not exist.'],
    ])('should show the server reason and create nothing when the claim is %s', (reason, detail) =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', '--format', 'json', '--invitation', CLAIM],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [],
        api: [refusal(422, `developer_invitation_claim_${reason}`, `${detail} ${CLAIM}`)],
        std: [
          { err: `${detail} <redacted>` },
          { not: 'Cannot generate your project.' },
          { not: 'envSecret' },
          { not: CLAIM },
        ],
        exitCode: 1,
      }),
    );

    it.each([
      ['empty', ''],
      ['too short', 'a'.repeat(21)],
      ['too long', 'a'.repeat(257)],
      ['a shell command', `${'a'.repeat(15)};rm${'a'.repeat(10)}`],
      ['a URL', 'https://app.forestadmin.com/invitations/abcdefghijklmnop'],
    ])('should refuse a claim that is %s before login, without echoing it', (_, value) =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name', `--invitation=${value}`],
        env: testEnvWithSecret,
        token: null,
        prompts: [],
        std: [
          { err: 'The --invitation value is not a valid invitation claim.' },
          { not: 'Login required' },
          ...(value ? [{ not: value }] : []),
        ],
        exitCode: 1,
      }),
    );

    it.each([
      ['a stray positional', ['name', CLAIM]],
      ['a mistyped flag', ['name', `--invitaton=${CLAIM}`]],
    ])(
      'should never echo a claim passed as %s',
      async (_, args) => {
        expect.hasAssertions();

        const error = await InAppCommand.run(args).catch(thrown => thrown);

        expect(error.message).toContain('<redacted>');
        expect(error.message).not.toContain(CLAIM);
        expect(error.stack).not.toContain(CLAIM);
      },
      30000,
    );

    it('should keep the flag out of --help', () => {
      expect.hasAssertions();
      expect(InAppCommand.flags.invitation.hidden).toBe(true);
    });
  });
});
