const testCli = require('../../test-cli-helper/test-cli');
const DemoCommand = require('../../../../src/commands/projects/create/demo').default;
const { testEnvWithSecret } = require('../../../fixtures/env');
const { createProject, updateNewEnvironmentEndpoint } = require('../../../fixtures/api');
const { default: Agents } = require('../../../../src/utils/agents');
const { default: languages } = require('../../../../src/utils/languages');

describe('projects:create:demo', () => {
  describe('execution', () => {
    it('should create a demo project on the dummy datasource, skipping all database steps', () =>
      testCli({
        commandClass: DemoCommand,
        commandArgs: ['name', '--applicationHost', 'http://localhost', '--applicationPort', '3310'],
        env: testEnvWithSecret,
        token: 'any',
        prompts: [
          {
            in: [
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
            ],
            out: { language: languages.Javascript },
          },
        ],
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
  });
});
