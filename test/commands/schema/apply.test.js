const testCli = require('../test-cli-helper/test-cli');
const ApplySchemaCommand = require('../../../src/commands/schema/apply');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../fixtures/env');
const {
  postSchema,
  postSchema404,
  postSchema500,
  postSchema503,
  loginValidOidc,
} = require('../../fixtures/api');

const {
  forestadminSchema,
  forestadminSchemaSnake,
  forestadminNewMetaFormat,
  forestadminWrongMetaFormat,
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

function postSchemaNewMetaFormatMatch(body) {
  expect(body).toMatchObject({
    meta: {
      liana: 'forest-express-sequelize',
      liana_version: '2.16.9',
      stack: {
        orm_version: '3.24.8',
        database_type: 'postgres',
      },
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
    it('should login the user and then send the schema', () =>
      testCli({
        files: [
          {
            name: '.forestadmin-schema.json',
            content: forestadminSchema,
          },
        ],
        env: testEnvWithSecret,
        api: [() => loginValidOidc(), () => postSchema(postSchemaMatch)],
        commandClass: ApplySchemaCommand,
        std: [
          {
            out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check?code=ABCD\nYour confirmation code: USER-CODE',
          },
          { out: 'Reading ".forestadmin-schema.json" from current directory...' },
          {
            out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
          },
          { out: 'Sending ".forestadmin-schema.json"...' },
          { out: 'The schema is the same as before, nothing changed.' },
        ],
      }));
  });

  describe('when the user is logged in', () => {
    describe('with no environment secret', () => {
      it('should exist with code 2', () =>
        testCli({
          files: [
            {
              name: '.forestadmin-schema.json',
              content: forestadminSchema,
            },
          ],
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: ApplySchemaCommand,
          std: [
            {
              err: '× Cannot find your forest environment secret in the environment variable "FOREST_ENV_SECRET".',
            },
            {
              err: 'Please set the "FOREST_ENV_SECRET" variable or pass the secret in parameter using --secret.',
            },
          ],
          exitCode: 2,
        }));
    });

    describe('with an environment secret set in "FOREST_ENV_SECRET" environment variable', () => {
      describe('with forest server returning 404', () => {
        it('should exit with exit code 4', () =>
          testCli({
            files: [
              {
                name: '.forestadmin-schema.json',
                content: forestadminSchema,
              },
            ],
            token: 'any',
            env: testEnvWithSecret,
            commandClass: ApplySchemaCommand,
            api: [() => postSchema404()],
            std: [
              {
                err: '× Cannot find the project related to the environment secret you configured.',
              },
            ],
            exitCode: 4,
          }));
      });

      describe('with forest server returning 503', () => {
        it('should exit with exit code 5', () =>
          testCli({
            files: [
              {
                name: '.forestadmin-schema.json',
                content: forestadminSchema,
              },
            ],
            env: testEnvWithSecret,
            api: [() => postSchema503()],
            commandClass: ApplySchemaCommand,
            std: [
              {
                err: '× Forest is in maintenance for a few minutes. We are upgrading your experience in the forest. We just need a few more minutes to get it right.',
              },
            ],
            exitCode: 5,
            token: 'any',
          }));
      });

      describe('with forest server returning 200', () => {
        describe('with a schema with camelcased keys', () => {
          it('should send the schema', () =>
            testCli({
              files: [
                {
                  name: '.forestadmin-schema.json',
                  content: forestadminSchema,
                },
              ],
              env: testEnvWithSecret,
              token: 'any',
              api: [() => postSchema(postSchemaMatch)],
              commandClass: ApplySchemaCommand,
              std: [
                { out: 'Reading ".forestadmin-schema.json" from current directory...' },
                {
                  out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
                },
                { out: 'Sending ".forestadmin-schema.json"...' },
                { out: 'The schema is the same as before, nothing changed.' },
              ],
            }));
        });

        describe('with a schema with snakecased keys', () => {
          it('should send the schema', () =>
            testCli({
              files: [
                {
                  name: '.forestadmin-schema.json',
                  content: forestadminSchemaSnake,
                },
              ],
              env: testEnvWithSecret,
              token: 'any',
              api: [() => postSchema(postSchemaMatch)],
              commandClass: ApplySchemaCommand,
              std: [
                { out: 'Reading ".forestadmin-schema.json" from current directory...' },
                {
                  out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
                },
                { out: 'Sending ".forestadmin-schema.json"...' },
                { out: 'The schema is the same as before, nothing changed.' },
              ],
            }));
        });

        describe('with a schema with new meta format keys', () => {
          it('should send the schema', () =>
            testCli({
              files: [
                {
                  name: '.forestadmin-schema.json',
                  content: forestadminNewMetaFormat,
                },
              ],
              env: testEnvWithSecret,
              token: 'any',
              api: [() => postSchema(postSchemaNewMetaFormatMatch)],
              commandClass: ApplySchemaCommand,
              std: [
                { out: 'Reading ".forestadmin-schema.json" from current directory...' },
                {
                  out: 'Using the forest environment secret found in the environment variable "FOREST_ENV_SECRET"',
                },
                { out: 'Sending ".forestadmin-schema.json"...' },
                { out: 'The schema is the same as before, nothing changed.' },
              ],
            }));
        });

        describe('with a schema with new and old meta format keys', () => {
          it('should exit with code 20', () =>
            testCli({
              files: [
                {
                  name: '.forestadmin-schema.json',
                  content: forestadminWrongMetaFormat,
                },
              ],
              env: testEnvWithSecret,
              token: 'any',
              commandClass: ApplySchemaCommand,
              std: [
                { err: '× Cannot properly read the ".forestadmin-schema.json" file:' },
                { err: '× | "meta.orm_version" is not allowed' },
              ],
              exitCode: 20,
            }));
        });
      });
    });
  });

  describe('with forest server returning nothing', () => {
    it('should exit with exit code 6', () =>
      testCli({
        files: [
          {
            name: '.forestadmin-schema.json',
            content: forestadminSchema,
          },
        ],
        env: testEnvWithSecret,
        token: 'any',
        api: [() => postSchema500()],
        commandClass: ApplySchemaCommand,
        std: [
          {
            err: '× An error occured with the schema sent to Forest. Please contact support@forestadmin.com for further investigations.',
          },
        ],
        exitCode: 6,
      }));
  });
});
