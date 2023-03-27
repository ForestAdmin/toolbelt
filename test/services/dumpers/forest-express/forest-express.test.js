const Context = require('@forestadmin/context');
const fs = require('fs');
const os = require('os');
const rimraf = require('rimraf');
const Dumper = require('../../../../src/services/dumpers/forest-express');
const defaultPlan = require('../../../../src/context/plan');

const DOCKER_COMPOSE_FILE_LOCATION = './test-output/Linux/docker-compose.yml';
const DOT_ENV_FILE_LOCATION = './test-output/Linux/.env';
const FORESTADMIN_FILE_LOCATION = './test-output/Linux/middlewares/forestadmin.js';

function cleanOutput() {
  rimraf.sync('./test-output/Linux');
}

/**
 * @param {{
 *   dbConnectionUrl?: string;
 *   appHostname?: string;
 *   appPort?: number;
 * }} [overrides]
 */
async function createLinuxDump(
  optionsOverrides = { appConfig: {}, dbConfig: {} },
  injectedContextOverrides = {},
) {
  const config = {
    appConfig: {
      appName: 'test-output/Linux',
      appHostname: 'localhost',
      appPort: 1654,
      ...optionsOverrides.appConfig,
    },
    dbConfig: {
      dbDialect: 'mysql',
      dbConnectionUrl: 'mysql://localhost:8999',
      dbSsl: false,
      dbSchema: 'public',
      ...optionsOverrides.dbConfig,
    },
  };

  const injectedContext = Context.execute(defaultPlan);
  const dumper = new Dumper({ ...injectedContext, ...injectedContextOverrides });
  await dumper.dump(config, {});
}

describe('services > dumper', () => {
  describe('on a linux based OS', () => {
    describe('when the database is on the local machine', () => {
      let osStub;

      // eslint-disable-next-line jest/no-hooks
      beforeAll(() => {
        osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');
      });

      // eslint-disable-next-line jest/no-hooks
      afterAll(() => {
        osStub.mockRestore();
      });

      it('should not make use of `host.docker.internal`', async () => {
        expect.assertions(2);

        await createLinuxDump();

        const dockerComposeFile = fs.readFileSync(DOCKER_COMPOSE_FILE_LOCATION, 'utf-8');
        const dotEnvFile = fs.readFileSync(DOT_ENV_FILE_LOCATION, 'utf-8');

        expect(dockerComposeFile).not.toContain('host.docker.internal');
        expect(dotEnvFile).not.toContain('host.docker.internal');

        cleanOutput();
      });

      describe('when the database is local on the system', () => {
        it('should use `network` option set to `host` in the docker-compose file', async () => {
          expect.assertions(1);

          await createLinuxDump();

          const dockerComposeFile = fs.readFileSync(DOCKER_COMPOSE_FILE_LOCATION, 'utf-8');
          expect(dockerComposeFile).toContain('network: host');

          cleanOutput();
        });
      });

      describe('when the database is not local on the system', () => {
        it('should not use `network` option in the docker-compose file', async () => {
          expect.assertions(1);

          await createLinuxDump({ dbConfig: { dbConnectionUrl: 'mysql://example.com:8999' } });

          const dockerComposeFile = fs.readFileSync(DOCKER_COMPOSE_FILE_LOCATION, 'utf-8');
          expect(dockerComposeFile).not.toContain('network');

          cleanOutput();
        });
      });
    });
  });

  describe('generation of APPLICATION_URL', () => {
    /**
     * @param {{appHostname?: string; appPort?: number}} overrides
     */
    async function generateEnvFile(overrides) {
      await createLinuxDump(overrides);

      return fs.readFileSync(DOT_ENV_FILE_LOCATION, 'utf-8');
    }

    describe('with an external application url', () => {
      it('should generate an APPLICATION_URL without the port number', async () => {
        expect.assertions(1);
        try {
          const dotEnvFile = await generateEnvFile({
            appConfig: {
              appHostname: 'agent.forestadmin.com',
            },
          });

          expect(dotEnvFile).toContain('APPLICATION_URL=http://agent.forestadmin.com');
        } finally {
          cleanOutput();
        }
      });

      it('should generate an APPLICATION_URL with the right protocol and without the port number', async () => {
        expect.assertions(1);

        try {
          const dotEnvFile = await generateEnvFile({
            appConfig: {
              appHostname: 'https://agent.forestadmin.com',
            },
          });

          expect(dotEnvFile).toContain('APPLICATION_URL=https://agent.forestadmin.com');
        } finally {
          cleanOutput();
        }
      });
    });

    describe('with a local url', () => {
      it('should append the port number to the url', async () => {
        expect.assertions(1);

        try {
          const dotEnvFile = await generateEnvFile({
            appConfig: {
              appHostname: 'http://localhost',
              appPort: 3333,
            },
          });

          expect(dotEnvFile).toContain('APPLICATION_URL=http://localhost:3333');
        } finally {
          cleanOutput();
        }
      });

      it('should add the protocol and append the port number', async () => {
        expect.assertions(1);

        try {
          const dotEnvFile = await generateEnvFile({
            appConfig: {
              appHostname: 'localhost',
              appPort: 3333,
            },
          });

          expect(dotEnvFile).toContain('APPLICATION_URL=http://localhost:3333');
        } finally {
          cleanOutput();
        }
      });
    });

    describe('using an environment variable FOREST_SERVER_URL', () => {
      async function generateDockerComposeFile(contextOverrides) {
        await createLinuxDump({}, contextOverrides);

        return fs.readFileSync(DOCKER_COMPOSE_FILE_LOCATION, 'utf-8');
      }

      describe('when the variable is defined', () => {
        it('should add the FOREST_URL definition in docker-compose file', async () => {
          expect.assertions(1);

          try {
            const dockerComposeFile = await generateDockerComposeFile({
              env: {
                FOREST_SERVER_URL: 'https://api.something.com',
              },
            });

            expect(dockerComposeFile).toContain(
              // eslint-disable-next-line no-template-curly-in-string
              'FOREST_URL=${FOREST_URL-https://api.something.com}',
            );
          } finally {
            cleanOutput();
          }
        });
      });

      describe('when the variable is not defined', () => {
        it('should not add the FOREST_URL definition in docker-compose file', async () => {
          expect.assertions(1);

          try {
            const dockerComposeFile = await generateDockerComposeFile({
              env: { FOREST_URL_IS_DEFAULT: true },
            });

            expect(dockerComposeFile).not.toContain('FOREST_URL');
          } finally {
            cleanOutput();
          }
        });
      });
    });
  });

  describe('generation of ForestAdmin middleware', () => {
    async function generateForestAdminFile(overrides) {
      await createLinuxDump(overrides);

      return fs.readFileSync(FORESTADMIN_FILE_LOCATION, 'utf-8');
    }

    it('should default "schemaDir" to "process.env.FOREST_SCHEMA_DIR"', async () => {
      expect.assertions(1);
      try {
        const forestAdminFile = await generateForestAdminFile({});

        expect(forestAdminFile).toContain('schemaDir: process.env.FOREST_SCHEMA_DIR,');
      } finally {
        cleanOutput();
      }
    });
  });
});
