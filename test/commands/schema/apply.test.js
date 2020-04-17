const testCli = require('./../test-cli');
const ApplySchemaCommand = require('../../../src/commands/schema/apply');
const { testEnv, testEnv2 } = require('../../fixtures/env');
const {
  postSchema,
  postSchema404,
  postSchema500,
  postSchema503,
} = require('../../fixtures/api');

const {
  forestadminSchema,
  forestadminSchemaSnake,
} = require('../../fixtures/files');

describe('schema:apply', () => {
  describe('with no environment secret', () => {
    it('should exist with code 2', () => testCli({
      file: {
        chdir: '/tmp',
        name: './.forestadmin-schema.json',
        content: forestadminSchema,
      },
      env: testEnv,
      token: 'any',
      command: () => ApplySchemaCommand.run([]),
      exitCode: 2,
      exitMessage: 'Cannot find your forest environment secret'
        + ' in the environment variable "FOREST_ENV_SECRET".\n'
        + 'Please set the "FOREST_ENV_SECRET" variable or pass the secret in parameter using'
        + ' --secret.',
    }));
  });

  describe('with an environment secret set in "FOREST_ENV_SECRET" environment variable', () => {
    describe('with forest server returning 404', () => {
      it('should exit with exit code 4', () => testCli({
        file: {
          chdir: '/tmp',
          name: './.forestadmin-schema.json',
          content: forestadminSchema,
        },
        env: testEnv2,
        command: () => ApplySchemaCommand.run([]),
        api: [postSchema404()],
        exitCode: 4,
        exitMessage: 'Cannot find the project related to the environment secret you configured.',
      }));
    });

    describe('with forest server returning 503', () => {
      it('should exit with exit code 5', () => testCli({
        file: {
          chdir: '/tmp',
          name: './.forestadmin-schema.json',
          content: forestadminSchema,
        },
        env: testEnv2,
        api: [postSchema503()],
        command: () => ApplySchemaCommand.run([]),
        exitCode: 5,
        exitMessage: 'Forest is in maintenance for a few minutes. We are upgrading your'
          + ' experience in the forest. We just need a few more minutes to get it right.',
      }));
    });

    describe('with forest server returning 200', () => {
      const postSchemaMatch = (body) => {
        expect(body).toMatchObject({
          meta: {
            liana: 'forest-express-sequelize',
            orm_version: '3.24.8',
            database_type: 'postgres',
            liana_version: '2.16.9',
          },
          data: [
            {
              type: 'collections',
              id: 'Users',
              attributes: {
                name: 'Users',
              },
            },
          ],
        });
        return true;
      };

      describe('with a schema with camelcased keys', () => {
        it('should send the schema', () => testCli({
          file: {
            chdir: '/tmp',
            name: './.forestadmin-schema.json',
            content: forestadminSchema,
          },
          env: testEnv2,
          token: 'any',
          api: [postSchema(postSchemaMatch)],
          command: () => ApplySchemaCommand.run([]),
          std: [
            { out: 'Reading "./.forestadmin-schema.json"...' },
            {
              out: 'Using the forest environment secret found in the environment variable'
                + ' "FOREST_ENV_SECRET"',
            },
            { out: 'Sending "./.forestadmin-schema.json"...' },
            { out: 'The schema is the same as before, nothing changed.' },
          ],
        }));
      });

      describe('with a schema with snakecased keys', () => {
        it('should send the schema', () => testCli({
          file: {
            chdir: '/tmp',
            name: './.forestadmin-schema.json',
            content: forestadminSchemaSnake,
          },
          env: testEnv2,
          token: 'any',
          api: [postSchema(postSchemaMatch)],
          command: () => ApplySchemaCommand.run([]),
          std: [
            { out: 'Reading "./.forestadmin-schema.json"...' },
            {
              out: 'Using the forest environment secret found in the environment variable'
                + ' "FOREST_ENV_SECRET"',
            },
            { out: 'Sending "./.forestadmin-schema.json"...' },
            { out: 'The schema is the same as before, nothing changed.' },
          ],
        }));
      });
    });
  });
});

describe('with forest server returning nothing', () => {
  it('should exit with exit code 6', () => testCli({
    file: {
      chdir: '/tmp',
      name: './.forestadmin-schema.json',
      content: forestadminSchema,
    },
    env: testEnv2,
    token: 'any',
    api: [postSchema500()],
    command: () => ApplySchemaCommand.run([]),
    exitCode: 6,
    exitMessage: 'An error occured with the schema sent to Forest. Please contact '
      + 'support@forestadmin.com for further investigations.',
  }));
});
