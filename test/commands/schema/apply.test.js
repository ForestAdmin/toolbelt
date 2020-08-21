const testCli = require('./../test-cli');
const ApplySchemaCommand = require('../../../src/commands/schema/apply');
const { testEnv, testEnv2 } = require('../../fixtures/env');
const {
  loginValid,
  postSchema,
  postSchema404,
  postSchema500,
  postSchema503,
} = require('../../fixtures/api');
const { loginPasswordDialog } = require('../../fixtures/std');

const {
  forestadminSchema,
  forestadminSchemaSnake,
} = require('../../fixtures/files');

function postSchemaMatch(body) {
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
}

describe('schema:apply', () => {
  describe('when the user is not logged in', () => {
    it('should ask for the login/password and then send the schema', () => testCli({
      file: {
        name: '.forestadmin-schema.json',
        content: forestadminSchema,
      },
      env: testEnv2,
      api: [
        loginValid(),
        postSchema(postSchemaMatch),
      ],
      command: () => ApplySchemaCommand.run([]),
      std: [
        ...loginPasswordDialog,
        { out: 'Reading "./.forestadmin-schema.json"...' },
        {
          out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
        },
        { out: 'Sending "./.forestadmin-schema.json"...' },
        { out: 'The schema is the same as before, nothing changed.' },
      ],
    }));
  });

  describe('when the user is logged in', () => {
    describe('with no environment secret', () => {
      it('should exist with code 2', () => testCli({
        file: {
          name: '.forestadmin-schema.json',
          content: forestadminSchema,
        },
        env: testEnv,
        token: 'any',
        command: () => ApplySchemaCommand.run([]),
        std: [{
          err: 'Cannot find your forest environment secret in the environment variable "FOREST_ENV_SECRET".\n'
      + 'Please set the "FOREST_ENV_SECRET" variable or pass the secret in parameter using --secret.',
        }],
        exitCode: 2,
      }));
    });

    describe('with an environment secret set in "FOREST_ENV_SECRET" environment variable', () => {
      describe('with forest server returning 404', () => {
        it('should exit with exit code 4', () => testCli({
          file: {
            name: '.forestadmin-schema.json',
            content: forestadminSchema,
          },
          token: 'any',
          env: testEnv2,
          command: () => ApplySchemaCommand.run([]),
          api: [postSchema404()],
          std: [{ err: 'Cannot find the project related to the environment secret you configured.' }],
          exitCode: 4,
        }));
      });

      describe('with forest server returning 503', () => {
        it('should exit with exit code 5', () => testCli({
          file: {
            name: '.forestadmin-schema.json',
            content: forestadminSchema,
          },
          env: testEnv2,
          api: [postSchema503()],
          command: () => ApplySchemaCommand.run([]),
          std: [{ err: 'Forest is in maintenance for a few minutes. We are upgrading your experience in the forest. We just need a few more minutes to get it right.' }],
          exitCode: 5,
          token: 'any',
        }));
      });

      describe('with forest server returning 200', () => {
        describe('with a schema with camelcased keys', () => {
          it('should send the schema', () => testCli({
            file: {
              name: '.forestadmin-schema.json',
              content: forestadminSchema,
            },
            env: testEnv2,
            token: 'any',
            api: [postSchema(postSchemaMatch)],
            command: () => ApplySchemaCommand.run([]),
            std: [
              { out: 'Reading "./.forestadmin-schema.json"...' },
              {
                out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
              },
              { out: 'Sending "./.forestadmin-schema.json"...' },
              { out: 'The schema is the same as before, nothing changed.' },
            ],
          }));
        });

        describe('with a schema with snakecased keys', () => {
          it('should send the schema', () => testCli({
            file: {
              name: '.forestadmin-schema.json',
              content: forestadminSchemaSnake,
            },
            env: testEnv2,
            token: 'any',
            api: [postSchema(postSchemaMatch)],
            command: () => ApplySchemaCommand.run([]),
            std: [
              { out: 'Reading "./.forestadmin-schema.json"...' },
              {
                out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
              },
              { out: 'Sending "./.forestadmin-schema.json"...' },
              { out: 'The schema is the same as before, nothing changed.' },
            ],
          }));
        });
      });
    });
  });
});

describe('with forest server returning nothing', () => {
  it('should exit with exit code 6', () => testCli({
    file: {
      name: '.forestadmin-schema.json',
      content: forestadminSchema,
    },
    env: testEnv2,
    token: 'any',
    api: [postSchema500()],
    command: () => ApplySchemaCommand.run([]),
    std: [{ err: 'An error occured with the schema sent to Forest. Please contact support@forestadmin.com for further investigations.' }],
    exitCode: 6,
  }));
});
