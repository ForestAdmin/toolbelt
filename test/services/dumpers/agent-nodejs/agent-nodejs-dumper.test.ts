import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJsDumper from '../../../../src/services/dumpers/agent-nodejs-dumper';

const DOCKER_COMPOSE_FILE_LOCATION = './test-output/Linux/docker-compose.yml';
const DOT_ENV_FILE_LOCATION = './test-output/Linux/.env';
const FORESTADMIN_FILE_LOCATION = './test-output/Linux/middlewares/forestadmin.js';
const TYPE_CAST = 'databaseOptions.dialectOptions.typeCast';

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
      applicationName: 'test-output/Linux',
      appHostname: 'localhost',
      appPort: 1654,
      ...optionsOverrides.appConfig,
    },
    dbConfig: {
      dbDialect: 'mysql',
      dbConnectionUrl: 'mysql://localhost:8999',
      ssl: false,
      dbSchema: 'public',
      ...optionsOverrides.dbConfig,
    },
    forestAuthSecret: 'forestAuthSecret',
    forestEnvSecret: 'forestEnvSecret',
  };

  const injectedContext = Context.execute(defaultPlan) as any;
  const dumper = new AgentNodeJsDumper({ ...injectedContext, ...injectedContextOverrides });
  await dumper.dump(config, {});
}

describe('services > dumpers > agentNodejsDumper', () => {
  describe('dump', () => {
    const configs = [
      {
        name: 'postgres',
        appConfig: {
          applicationName: 'test-output/postgres',
          appHostname: 'localhost',
          appPort: 1654,
          path: appRoot,
        },
        dbConfig: {
          dbDialect: 'postgres',
          dbConnectionUrl: 'postgres://localhost:54369',
          ssl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
      },
      {
        name: 'mysql',
        appConfig: {
          applicationName: 'test-output/mysql',
          appHostname: 'localhost',
          appPort: 1654,
          path: appRoot,
        },
        dbConfig: {
          dbDialect: 'mysql',
          dbConnectionUrl: 'mysql://localhost:8999',
          ssl: false,
          dbSchema: 'public',
        },
      },
      {
        name: 'mssql',
        appConfig: {
          applicationName: 'test-output/mssql',
          appHostname: 'localhost',
          appPort: 1654,
          path: appRoot,
        },
        dbConfig: {
          dbDialect: 'mssql',
          dbConnectionUrl: 'mssql://localhost:1432',
          ssl: false,
          dbSchema: 'public',
        },
      },
    ];

    const files = [
      'index.js',
      'package.json',
      'Dockerfile',
      'docker-compose.yml',
      '.env',
      '.gitignore',
      '.dockerignore',
    ];

    configs.forEach(config => {
      describe(`database ${config.name}`, () => {
        async function dump() {
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJsDumper(injectedContext);
          await dumper.dump(
            {
              appConfig: config.appConfig,
              dbConfig: config.dbConfig,
              forestAuthSecret: 'forestAuthSecret',
              forestEnvSecret: 'forestEnvSecret',
            },
            {},
          );
        }

        files.forEach(fileName => {
          it(`should properly dump ${fileName}`, async () => {
            expect.assertions(1);

            await dump();

            const generatedFile = fs.readFileSync(
              `${appRoot}/${config.appConfig.applicationName}/${fileName}`,
              'utf-8',
            );

            const expectedFile = fs.readFileSync(
              `${__dirname}/expected/${config.name}/${fileName}`,
              'utf-8',
            );

            expect(generatedFile).toStrictEqual(expectedFile);
            rimraf.sync(`${appRoot}/${config.appConfig.applicationName}`);
          });
        });
      });
    });

    describe('on a linux based OS', () => {
      describe('when the database is on the local machine', () => {
        const setupAndDump = async (dbConnectionUrl: string | null = null) => {
          const osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');
          const postgresConfig = configs.find(config => config.name === 'postgres');
          assert(postgresConfig);
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJsDumper(injectedContext);
          await dumper.dump(
            {
              appConfig: postgresConfig.appConfig,
              dbConfig: {
                ...postgresConfig.dbConfig,
                dbConnectionUrl: dbConnectionUrl || postgresConfig.dbConfig.dbConnectionUrl,
              },
              forestAuthSecret: 'forestAuthSecret',
              forestEnvSecret: 'forestEnvSecret',
            },
            {},
          );

          return { osStub, postgresConfig };
        };

        const cleanStub = osStub => {
          osStub.mockRestore();
        };

        it('should not make use of `host.docker.internal`', async () => {
          expect.assertions(2);

          const { osStub, postgresConfig } = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
            'utf-8',
          );

          expect(dockerComposeFile).not.toContain('DOCKER_DATABASE_URL');
          expect(dotEnvFile).not.toContain('host.docker.internal');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
          cleanStub(osStub);
        });

        describe('when the database is local on the system', () => {
          it('should use `network` option set to `host` in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump();
            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).toContain('network: host');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
            cleanStub(osStub);
          });
        });

        describe('when the database is not local on the system', () => {
          it('should not use `network` option in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump('mysql://example.com:8999');

            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
            cleanStub(osStub);
          });
        });
      });
    });

    describe('on a non linux based OS', () => {
      describe('when the database is on the local machine', () => {
        const setupAndDump = async (dbConnectionUrl: string | null = null) => {
          const osStub = jest.spyOn(os, 'platform').mockReturnValue('darwin');
          const postgresConfig = configs.find(config => config.name === 'postgres');
          assert(postgresConfig);
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJsDumper(injectedContext);
          await dumper.dump(
            {
              appConfig: postgresConfig.appConfig,
              dbConfig: {
                ...postgresConfig.dbConfig,
                dbConnectionUrl: dbConnectionUrl || postgresConfig.dbConfig.dbConnectionUrl,
              },
              forestAuthSecret: 'forestAuthSecret',
              forestEnvSecret: 'forestEnvSecret',
            },
            {},
          );

          return { osStub, postgresConfig };
        };

        const cleanStub = osStub => {
          osStub.mockRestore();
        };

        it('should make use of `host.docker.internal`', async () => {
          expect.assertions(2);

          const { osStub, postgresConfig } = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
            'utf-8',
          );

          expect(dockerComposeFile).toContain('DOCKER_DATABASE_URL');
          expect(dotEnvFile).toContain('host.docker.internal');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
          cleanStub(osStub);
        });

        describe('when the database is local on the system', () => {
          it('should not use `network` option set to `host` in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump();
            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
            cleanStub(osStub);
          });
        });

        describe('when the database is not local on the system', () => {
          it('should not use `network` option in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump('mysql://example.com:8999');

            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
            cleanStub(osStub);
          });
        });
      });
    });
  });
});
