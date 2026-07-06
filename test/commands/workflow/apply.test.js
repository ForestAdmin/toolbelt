const nock = require('nock');

const testCli = require('../test-cli-helper/test-cli');
const WorkflowApplyCommand = require('../../../src/commands/workflow/apply').default;
const ProjectSerializer = require('../../../src/serializers/project');
const { compileWorkflowToBpmn } = require('../../../src/services/layout/workflow-bpmn');
const { getEnvironmentListValid, getTeamsValid } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

const SERVER = 'http://localhost:3001';
const S3 = 'http://localhost:9001';
const SPEC_FILE = 'workflow.json';

// The layout HTTP path lazily loads Node's deprecated `punycode`, whose DEP0040
// warning leaks into captured stderr. Cases that don't assert on stderr disable
// the empty-stderr check so that environmental noise can't flake them.

// `-p 2 -e name2 -t Operations` resolve to project2 / name2 / Operations,
// so every workflow call targets /api/workflows/project2/name2/Operations.
const WORKFLOWS_URL = '/api/workflows/project2/name2/Operations';
const RENDERING_URL = '/api/renderings/project2/name2/Operations';

const SCOPE_FLAGS = ['-p', '2', '-e', 'name2', '-t', 'Operations'];

const spec = {
  collection: 'cards',
  name: 'Triage',
  steps: [
    { id: 'read1', next: 'done', type: 'read' },
    { id: 'done', type: 'end' },
  ],
};

const specFile = (content = spec) => [
  { name: SPEC_FILE, content: typeof content === 'string' ? content : JSON.stringify(content) },
];

// The remote shell `forest workflow apply` upserts (as served by GET /api/workflows/...).
const remoteWorkflow = overrides => ({
  bpmnAwsS3Identifier: 'v0',
  collectionId: 'cards',
  id: '11',
  isVisible: true,
  name: 'Triage',
  position: 0,
  segmentIds: [],
  ...overrides,
});

// The 3 calls resolveCommandScope makes (project by id, environments, teams).
const scopeApi = [
  () =>
    nock(SERVER)
      .get('/api/projects/2')
      .reply(200, ProjectSerializer.serialize({ id: 2, name: 'project2' })),
  () => getEnvironmentListValid(),
  () => getTeamsValid(),
];

// planApply always reads the workflows document and the rendering id.
const planApi = workflows => [
  ...scopeApi,
  () => nock(SERVER).get(WORKFLOWS_URL).reply(200, workflows),
  () =>
    nock(SERVER)
      .get(RENDERING_URL)
      .reply(200, { data: { id: '42', type: 'renderings' } }),
];

// The stored-BPMN read used for idempotency (presigned GET + S3 fetch).
const storedBpmnApi = bpmn => [
  () =>
    nock(SERVER)
      .get('/api/workflows/11/bpmn')
      .query(true)
      .reply(200, { signedUrl: `${S3}/stored.bpmn` }),
  () => nock(S3).get('/stored.bpmn').reply(200, bpmn, { 'Content-Type': 'text/xml' }),
];

// The upload leg: presigned POST, S3 multipart POST, bpmnAwsS3Identifier PATCH.
const uploadApi = [
  () =>
    nock(SERVER)
      .post(/\/api\/workflows\/[^/]+\/generate-presigned-request$/)
      .query(true)
      .reply(200, { fields: { key: 'k' }, url: `${S3}/upload` }),
  () => nock(S3).post('/upload').reply(201, '', { 'x-amz-version-id': 'v1' }),
  () => nock(SERVER).patch('/api/workflows').reply(204),
];

describe('workflow:apply', () => {
  describe('when the spec comes from stdin without an explicit scope', () => {
    it('errors out immediately instead of prompting', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [],
        api: [],
        exitCode: 2,
        std: [{ err: 'Reading the spec from stdin disables interactive prompts' }],
        assertNoStdError: false,
      }));
  });

  describe('when the spec file does not exist', () => {
    it('errors out with a clean message, without hitting the API', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, 'missing.json'],
        api: [],
        exitCode: 2,
        std: [{ err: 'Cannot read spec file "missing.json": no such file' }],
        assertNoStdError: false,
      }));
  });

  describe('when the spec is not valid JSON', () => {
    it('errors out with a clean message, without hitting the API', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, SPEC_FILE],
        files: specFile('{ oops'),
        api: [],
        exitCode: 2,
        std: [{ err: 'Invalid JSON in spec:' }],
        assertNoStdError: false,
      }));
  });

  describe('when the spec has a typoed field', () => {
    it('suggests the intended field', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, SPEC_FILE],
        files: specFile({
          ...spec,
          steps: [
            { autocomplete: true, id: 'read1', next: 'done', type: 'read' },
            { id: 'done', type: 'end' },
          ],
        }),
        api: [],
        exitCode: 2,
        std: [{ err: 'did you mean `autoComplete`?' }],
        assertNoStdError: false,
      }));
  });

  describe('when no workflow matches (create) with --force', () => {
    it('adds a shell, uploads the BPMN and links the version', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '-f', SPEC_FILE],
        files: specFile(),
        api: [
          ...planApi([]),
          () => nock(SERVER).patch('/api/workflows').reply(204), // add shell
          ...uploadApi,
        ],
        std: [
          { out: 'Will CREATE workflow "Triage" on collection cards (2 steps)' },
          { out: 'Created workflow' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('when a workflow matches and the spec changes its metadata (update) with --force', () => {
    it('patches the changed metadata and re-uploads the changed BPMN', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '-f', SPEC_FILE],
        files: specFile({ ...spec, segments: ['vip'] }),
        api: [
          ...planApi([remoteWorkflow({ segmentIds: ['old-seg'] })]),
          ...storedBpmnApi('<old-bpmn/>'),
          () => nock(SERVER).patch('/api/workflows').reply(204), // metadata replaces
          ...uploadApi,
        ],
        std: [
          { out: 'Will UPDATE workflow "Triage" (id 11)' },
          { out: 'segments: [old-seg] → [vip]' },
          { out: 'BPMN: recompiled and replaced' },
          { out: 'Updated workflow' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('when the workflow already matches the spec', () => {
    it('is idempotent: uploads nothing and says so', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '-f', SPEC_FILE],
        files: specFile(),
        api: [...planApi([remoteWorkflow()]), ...storedBpmnApi(compileWorkflowToBpmn(spec))],
        std: [{ out: 'Nothing to apply: the workflow already matches the spec.' }],
        assertNoStdError: false,
      }));
  });

  describe('with --dry-run on an existing workflow', () => {
    it('resolves the scope, prints the would-be update and sends nothing', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '--dry-run', SPEC_FILE],
        files: specFile({ ...spec, name: 'Triage v2', id: '11' }),
        api: [...planApi([remoteWorkflow()]), ...storedBpmnApi('<old-bpmn/>')],
        std: [
          { out: 'Would UPDATE workflow "Triage" (id 11)' },
          { out: 'name: "Triage" → "Triage v2"' },
          { out: '(dry-run: nothing sent)' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('when the confirmation is declined', () => {
    it('applies nothing and logs that it aborted', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, SPEC_FILE],
        files: specFile(),
        api: planApi([]),
        prompts: [
          {
            in: [
              {
                message: 'Apply this workflow to name2 / Operations?',
                name: 'confirm',
                type: 'confirm',
              },
            ],
            out: { confirm: false },
          },
        ],
        std: [{ out: 'Will CREATE workflow "Triage"' }, { out: 'Aborted' }],
        assertNoStdError: false,
      }));
  });

  describe('when the BPMN upload fails right after creating the shell', () => {
    it('rolls the shell back and surfaces the server error', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '-f', SPEC_FILE],
        files: specFile(),
        api: [
          ...planApi([]),
          () => nock(SERVER).patch('/api/workflows').reply(204), // add shell
          () =>
            nock(SERVER)
              .post(/\/api\/workflows\/[^/]+\/generate-presigned-request$/)
              .query(true)
              .reply(500, { errors: [{ detail: 'boom' }] }),
          () => nock(SERVER).patch('/api/workflows').reply(204), // rollback remove
        ],
        exitCode: 2,
        std: [{ out: 'Will CREATE workflow "Triage"' }, { err: 'Server error (500)' }],
        assertNoStdError: false,
      }));
  });

  describe('when the rollback itself fails', () => {
    it('warns that a BPMN-less workflow may remain', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: WorkflowApplyCommand,
        commandArgs: [...SCOPE_FLAGS, '-f', SPEC_FILE],
        files: specFile(),
        api: [
          ...planApi([]),
          () => nock(SERVER).patch('/api/workflows').reply(204), // add shell
          () =>
            nock(SERVER)
              .post(/\/api\/workflows\/[^/]+\/generate-presigned-request$/)
              .query(true)
              .reply(500, { errors: [{ detail: 'boom' }] }),
          () => nock(SERVER).patch('/api/workflows').reply(500), // rollback fails too
        ],
        exitCode: 2,
        std: [{ out: 'Failed to roll back workflow shell' }, { err: 'Server error (500)' }],
        assertNoStdError: false,
      }));
  });
});
