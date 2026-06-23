const nock = require('nock');

const testCli = require('../test-cli-helper/test-cli');
const LayoutApplyCommand = require('../../../src/commands/layout/apply').default;
const ProjectSerializer = require('../../../src/serializers/project');
const { getEnvironmentListValid, getTeamsValid } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

const SERVER = 'http://localhost:3001';
const LAYOUT_FILE = 'forest-layout.json';

// The layout HTTP path lazily loads Node's deprecated `punycode`, whose DEP0040
// warning leaks into captured stderr. Cases that don't assert on stderr disable
// the empty-stderr check so that environmental noise can't flake them.

// `-p 2 -e name2 -t Operations` resolve to project2 / name2 / Operations,
// so every layout call targets /api/<domain>/project2/name2/Operations.
const FOLDERS_URL = '/api/folders/project2/name2/Operations';

// Flags fully supply the scope; the header only has to exist and carry a version.
const fileWithFolder = name => [
  {
    name: LAYOUT_FILE,
    content: JSON.stringify({ forest: { version: 1 }, folders: [{ id: 12, name }] }, null, 2),
  },
];

// The 3 calls resolveCommandScope makes (project by id, environments, teams).
const scopeApi = [
  () =>
    nock(SERVER)
      .get('/api/projects/2')
      .reply(200, ProjectSerializer.serialize({ id: 2, name: 'project2' })),
  () => getEnvironmentListValid(),
  () => getTeamsValid(),
];

describe('layout:apply', () => {
  describe('when the file argument is missing', () => {
    it('errors out without hitting the API', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: ['-p', '2', '-e', 'name2', '-t', 'Operations'],
        api: [],
        exitCode: 2,
        assertNoStdError: false,
      }));
  });

  describe('when the file already matches the environment', () => {
    it('applies nothing and reports an up-to-date environment', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: ['-p', '2', '-e', 'name2', '-t', 'Operations', LAYOUT_FILE],
        files: [
          {
            name: 'forest-layout.json',
            content: JSON.stringify({ forest: { version: 1 }, folders: [] }, null, 2),
          },
        ],
        api: [...scopeApi, () => nock(SERVER).get(FOLDERS_URL).reply(200, [])],
        std: [{ out: 'Nothing to apply' }],
        assertNoStdError: false,
      }));
  });

  describe('with a change and --force', () => {
    it('sends one patch for the changed domain and confirms', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: ['-p', '2', '-e', 'name2', '-t', 'Operations', '-f', LAYOUT_FILE],
        files: fileWithFolder('Renamed'),
        api: [
          ...scopeApi,
          () =>
            nock(SERVER)
              .get(FOLDERS_URL)
              .reply(200, [{ id: 12, name: 'Original' }]),
          () => nock(SERVER).patch('/api/folders').reply(204),
        ],
        std: [{ out: 'Applied 1 change' }],
        assertNoStdError: false,
      }));
  });

  describe('when the server rejects the patch', () => {
    it('exits 2 and hints that re-running converges (idempotent)', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: ['-p', '2', '-e', 'name2', '-t', 'Operations', '-f', LAYOUT_FILE],
        files: fileWithFolder('Renamed'),
        api: [
          ...scopeApi,
          () =>
            nock(SERVER)
              .get(FOLDERS_URL)
              .reply(200, [{ id: 12, name: 'Original' }]),
          () =>
            nock(SERVER)
              .patch('/api/folders')
              .reply(403, { errors: [{ detail: 'forbidden' }] }),
        ],
        // error -> stderr; the idempotency hint (warn) -> stdout.
        std: [{ err: 'Access denied (403)' }, { out: 're-run it to converge' }],
        assertNoStdError: false,
        exitCode: 2,
      }));
  });

  describe('when the confirmation is declined', () => {
    it('applies nothing and logs that it aborted', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: ['-p', '2', '-e', 'name2', '-t', 'Operations', LAYOUT_FILE],
        files: fileWithFolder('Renamed'),
        api: [
          ...scopeApi,
          () =>
            nock(SERVER)
              .get(FOLDERS_URL)
              .reply(200, [{ id: 12, name: 'Original' }]),
        ],
        prompts: [
          {
            in: [
              {
                message: 'Apply these changes to name2 / Operations?',
                name: 'confirm',
                type: 'confirm',
              },
            ],
            out: { confirm: false },
          },
        ],
        std: [{ out: 'Aborted' }],
        assertNoStdError: false,
      }));
  });
});
