const testCli = require('../test-cli-helper/test-cli');
const UpdateCommand = require('../../../src/commands/schema/update');
const { baseAuthenticatedPlanMock } = require('../test-cli-helper/mocks/plan-mocks');

const { testEnvWithSecret } = require('../../fixtures/env');

describe('schema:update', () => {
  it('should pass all short options', async () => {
    expect.assertions(2);
    const databaseSchema = Symbol('database schema');
    const outputDirectory = '/output/directory';
    const dbConfigPath = 'db/config/path';
    const schemaServiceUpdate = jest.fn().mockResolvedValue(null);
    const planMock = [
      baseAuthenticatedPlanMock,
      (plan) => plan
        .addValue('env', { DATABASE_SCHEMA: databaseSchema })
        .addInstance('schemaService', { update: schemaServiceUpdate }),
    ];

    await testCli({
      commandClass: UpdateCommand,
      commandPlan: planMock,
      commandArgs: ['-c', dbConfigPath, '-o', outputDirectory],
      std: [{ out: '' }],
    });

    expect(schemaServiceUpdate)
      .toHaveBeenCalledWith({
        isUpdate: true,
        outputDirectory,
        dbSchema: databaseSchema,
        dbConfigPath,
      });
  });

  describe('schema:update', () => {
    describe('when run within a properly defined project', () => {
      it('should re-generate files', () => testCli({
        commandClass: UpdateCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [],
        files: [{
          name: 'package.json',
          content: '{ "dependencies": { "forest-express-sequelize": "7.0.0" } }',
        }, {
          name: 'config/databases.js',
          content: 'module.exports = [];',
        }, {
          directory: 'forest',
        }, {
          directory: 'models',
        }, {
          directory: 'routes',
        }],
        std: [
          { spinner: '√ Connecting to your database(s)' },
          { spinner: '√ Analyzing the database(s)' },
          { spinner: '√ Generating your files' },
        ],
      }));
    });
  });
});
