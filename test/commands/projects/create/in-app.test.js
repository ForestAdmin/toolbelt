const testCli = require('../../test-cli-helper/test-cli');
const InAppCommand = require('../../../../src/commands/projects/create/in-app').default;
const { testEnvWithSecret } = require('../../../fixtures/env');
const { createProject, updateNewEnvironmentEndpoint } = require('../../../fixtures/api');

describe('projects:create:in-app', () => {
  describe('execution', () => {
    it('should register an in-app project (no agent, no DB, no scaffold) and print the secrets + guidance', () =>
      testCli({
        commandClass: InAppCommand,
        commandArgs: ['name'],
        env: testEnvWithSecret,
        token: 'any',
        // Only host + port are prompted (no `language`: nothing is scaffolded).
        prompts: [
          {
            in: [
              {
                name: 'applicationHost',
                message: "What's the IP/hostname on which your application will be running?",
                type: 'input',
                default: 'http://localhost',
                validate: expect.any(Function),
              },
              {
                name: 'applicationPort',
                message: "What's the port on which your application will be running?",
                type: 'input',
                default: '3310',
                validate: expect.any(Function),
              },
            ],
            out: { applicationHost: 'http://localhost', applicationPort: '3310' },
          },
        ],
        api: [
          // The whole point: architecture 'in-app' + no agent (unlike every other create:*).
          () => createProject({ databaseType: null, agent: null, architecture: 'in-app' }),
          () => updateNewEnvironmentEndpoint(),
        ],
        std: [
          { spinner: '√ Creating your project on Forest Admin' },
          // No "Testing connection" / "Analyzing database" / "Creating your project files":
          // requiresDatabase = false and the command scaffolds nothing.
          { out: '> Hooray, installation success!' },
          { out: 'In-app project created — no code was scaffolded.' },
          { out: 'FOREST_ENV_SECRET=' },
          { out: 'FOREST_AUTH_SECRET=' },
          // The 5 Rails gems must be listed (forest_admin_rails alone does not boot).
          { out: 'forest_admin_datasource_active_record' },
          { out: 'npm install @forestadmin/agent' },
        ],
        exitCode: 0,
      }));
  });
});
