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

  describe('with --with-workflows and a BPMN sidecar to upload', () => {
    const WORKFLOW_ID = 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';
    const BPMN = '<bpmn:definitions />';
    const workflow = {
      id: WORKFLOW_ID,
      name: 'My workflow',
      collectionId: 'aml_alerts',
      isVisible: true,
      position: 0,
      segmentIds: [],
    };

    it('uploads the sidecar and links the fresh S3 version (source ref stripped)', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: LayoutApplyCommand,
        commandArgs: [
          '-p',
          '2',
          '-e',
          'name2',
          '-t',
          'Operations',
          '-f',
          '--with-workflows',
          LAYOUT_FILE,
        ],
        files: [
          {
            name: LAYOUT_FILE,
            content: JSON.stringify(
              {
                forest: { version: 1 },
                // The source ref is env-local: it must be stripped (0 ops), and the
                // sidecar upload must own the target's pointer instead.
                workflows: [{ ...workflow, bpmnAwsS3Identifier: 'source-env-version' }],
              },
              null,
              2,
            ),
          },
          { name: `workflows/${WORKFLOW_ID}.bpmn`, content: BPMN },
        ],
        api: [
          ...scopeApi,
          () =>
            nock(SERVER)
              .get('/api/workflows/project2/name2/Operations')
              // Same workflow in the target, without stored BPMN yet.
              .reply(200, [workflow]),
          () =>
            nock(SERVER)
              .get('/api/renderings/project2/name2/Operations')
              .reply(200, { data: { id: '42', type: 'renderings' } }),
          () =>
            nock(SERVER)
              .post(`/api/workflows/${WORKFLOW_ID}/generate-presigned-request`)
              .query({ collectionId: 'aml_alerts' })
              .reply(200, { url: `${SERVER}/s3-upload`, fields: { key: 'k' } }),
          () => nock(SERVER).post('/s3-upload').reply(204, '', { 'x-amz-version-id': 'v-new' }),
          () =>
            nock(SERVER)
              .patch('/api/workflows', [
                {
                  op: 'replace',
                  path: `/workflows/${WORKFLOW_ID}/bpmnAwsS3Identifier`,
                  value: 'v-new',
                },
              ])
              .reply(204),
        ],
        std: [{ out: 'upload BPMN sidecar' }, { out: 'Applied 0 changes + 1 workflow BPMN' }],
        assertNoStdError: false,
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
