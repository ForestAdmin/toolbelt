const testCli = require('../../test-cli-helper/test-cli');
const DemoCommand = require('../../../../src/commands/projects/create/demo').default;
const { testEnvWithSecret } = require('../../../fixtures/env');
const { createProject, updateNewEnvironmentEndpoint } = require('../../../fixtures/api');
const { default: Agents } = require('../../../../src/utils/agents');
const { default: languages } = require('../../../../src/utils/languages');

const languagePrompt = [
  {
    name: 'language',
    message: 'In which language would you like to generate your sources?',
    type: 'list',
    choices: [
      { name: languages.Javascript.name, value: languages.Javascript },
      { name: languages.Typescript.name, value: languages.Typescript },
    ],
    default: languages.Javascript,
  },
];

describe('projects:create:demo', () => {
  describe('execution', () => {
    it('should create a demo project on the dummy datasource, skipping all database steps', () =>
      testCli({
        commandClass: DemoCommand,
        commandArgs: ['name', '--applicationHost', 'http://localhost', '--applicationPort', '3310'],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [{ in: languagePrompt, out: { language: languages.Javascript } }],
        api: [
          () => createProject({ databaseType: null, agent: Agents.NodeJS }),
          () => updateNewEnvironmentEndpoint(),
        ],
        std: [
          { spinner: '√ Creating your project on Forest Admin' },
          // No "Testing connection" spinner: requiresDatabase = false → DB steps skipped.
          { spinner: '√ Creating your project files' },
          { out: 'create index.js' },
          { out: '> Hooray, installation success!' },
          { out: 'forest projects:create:sql' },
        ],
        exitCode: 0,
      }));

    it('should create the project in the organization given with --organization', () =>
      testCli({
        commandClass: DemoCommand,
        commandArgs: ['name', '-H', 'http://localhost', '-P', '3310', '--organization', '42'],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [{ in: languagePrompt, out: { language: languages.Javascript } }],
        api: [
          // The nock body is the assertion: the POST must carry the organization relationship.
          () => createProject({ databaseType: null, agent: Agents.NodeJS, organizationId: 42 }),
          () => updateNewEnvironmentEndpoint(),
        ],
        std: [
          { spinner: '√ Creating your project on Forest Admin' },
          { spinner: '√ Creating your project files' },
          { out: '> Hooray, installation success!' },
        ],
        exitCode: 0,
      }));
  });

  describe('with an invalid --organization', () => {
    it.each(['abc', '0', '-3', '1.5'])('should refuse %j before any request', organization =>
      testCli({
        commandClass: DemoCommand,
        commandArgs: ['name', '--organization', organization],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [],
        // No api entry: any request would fail the test on an unmatched nock.
        std: [
          {
            err: 'Invalid value for organization: The organization must be a positive integer id, like 42.',
          },
        ],
        exitCode: 1,
      }),
    );
  });
});
