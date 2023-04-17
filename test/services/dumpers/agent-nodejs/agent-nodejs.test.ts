import type { Config } from '../../../../src/interfaces/project-create-interface';
import type { Language } from '../../../../src/utils/languages';

import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import fs from 'fs';
import os from 'os';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJs from '../../../../src/services/dumpers/agent-nodejs';
import languages from '../../../../src/utils/languages';

describe('services > dumpers > agentNodejs', () => {
  describe('dump', () => {
    const getConfigs = (language: Language): Array<Config & { name: string }> => [
      {
        name: 'mongodb',
        appConfig: {
          appName: `test-output/${language.name}/mongodb`,
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mongodb',
          dbConnectionUrl: 'mongodb://localhost:27016',
          dbSsl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language,
      },
      {
        name: 'postgres',
        appConfig: {
          appName: `test-output/${language.name}/postgres`,
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'postgres',
          dbConnectionUrl: 'postgres://localhost:54369',
          dbSsl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language,
      },
      {
        name: 'mysql',
        appConfig: {
          appName: `test-output/${language.name}/mysql`,
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mysql',
          dbConnectionUrl: 'mysql://localhost:8999',
          dbSsl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language,
      },
      {
        name: 'mariadb',
        appConfig: {
          appName: `test-output/${language.name}/mariadb`,
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mariadb',
          dbConnectionUrl: 'mariadb://localhost:3305',
          dbSsl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language,
      },
      {
        name: 'mssql',
        appConfig: {
          appName: `test-output/${language.name}/mssql`,
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mssql',
          dbConnectionUrl: 'mssql://localhost:1432',
          dbSsl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language,
      },
    ];

    const getFiles = (language: Language) => [
      'package.json',
      'Dockerfile',
      'docker-compose.yml',
      'typings.ts',
      '.env',
      '.gitignore',
      '.dockerignore',
      `index.${language.fileExtension}`,
    ];

    describe.each([languages.Javascript, languages.Typescript])('language: $name', language => {
      const files = getFiles(language);
      describe.each(getConfigs(language))('database: $name', ({ name, appConfig, dbConfig }) => {
        async function dump() {
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs(injectedContext);
          await dumper.dump(
            {
              appConfig,
              dbConfig,
              forestAuthSecret: 'forestAuthSecret',
              forestEnvSecret: 'forestEnvSecret',
              language,
            },
            {},
          );
        }

        it.each(files)('should properly dump %s', async fileName => {
          expect.assertions(1);

          const osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');

          await dump();

          const generatedFile = fs.readFileSync(
            `${appRoot}/${appConfig.appName}/${fileName}`,
            'utf-8',
          );

          const expectedFile = fs.readFileSync(
            `${__dirname}/expected/${language.name}/${name}/${
              fileName === '.env' ? 'env' : fileName
            }`,
            'utf-8',
          );

          expect(generatedFile).toStrictEqual(expectedFile);
          rimraf.sync(`${appRoot}/${appConfig.appName}`);
          osStub.mockRestore();
        });
      });

      describe('on a linux based OS', () => {
        const setupAndDump = async (dbConnectionUrl: string | null = null) => {
          const osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: dbConnectionUrl || 'postgres://localhost:54369',
              dbSsl: false,
              dbSchema: 'public',
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs(injectedContext);
          await dumper.dump(postgresConfig, {});

          return { osStub, postgresConfig };
        };

        const cleanStub = osStub => {
          osStub.mockRestore();
        };

        it('should not make use of `host.docker.internal`', async () => {
          expect.assertions(2);

          const { osStub, postgresConfig } = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );

          expect(dockerComposeFile).not.toContain('DOCKER_DATABASE_URL');
          expect(dotEnvFile).not.toContain('host.docker.internal');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
          cleanStub(osStub);
        });

        describe('when the database is local on the system', () => {
          it('should use `network` option set to `host` in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump();
            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).toContain('network: host');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
            cleanStub(osStub);
          });
        });

        describe('when the database is not local on the system', () => {
          it('should not use `network` option in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump('mysql://example.com:8999');

            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
            cleanStub(osStub);
          });
        });
      });

      describe('on a non linux based OS', () => {
        const setupAndDump = async (dbConnectionUrl: string | null = null) => {
          const osStub = jest.spyOn(os, 'platform').mockReturnValue('darwin');
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: dbConnectionUrl || 'postgres://localhost:54369',
              dbSsl: false,
              dbSchema: 'public',
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs(injectedContext);
          await dumper.dump(postgresConfig, {});

          return { osStub, postgresConfig };
        };

        const cleanStub = osStub => {
          osStub.mockRestore();
        };

        it('should make use of `host.docker.internal`', async () => {
          expect.assertions(2);

          const { osStub, postgresConfig } = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );

          expect(dockerComposeFile).toContain('DOCKER_DATABASE_URL');
          expect(dotEnvFile).toContain('host.docker.internal');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
          cleanStub(osStub);
        });

        describe('when the database is local on the system', () => {
          it('should not use `network` option set to `host` in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump();
            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
            cleanStub(osStub);
          });
        });

        describe('when the database is not local on the system', () => {
          it('should not use `network` option in the docker-compose file', async () => {
            expect.assertions(1);

            const { osStub, postgresConfig } = await setupAndDump('mysql://example.com:8999');

            const dockerComposeFile = fs.readFileSync(
              `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
              'utf-8',
            );
            expect(dockerComposeFile).not.toContain('network');

            rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
            cleanStub(osStub);
          });
        });
      });

      describe('with a FOREST_SERVER_URL', () => {
        const setupAndDump = async () => {
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: 'postgres://localhost:54369',
              dbSsl: false,
              dbSchema: 'public',
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext: any = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs({
            ...injectedContext,
            env: {
              ...injectedContext.env,
              FOREST_SERVER_URL: 'http://localhost:3001',
              FOREST_URL_IS_DEFAULT: false,
            },
          });
          await dumper.dump(postgresConfig, {});

          return postgresConfig;
        };

        it(`should set \`forestServerURl\` in \`.env\` and \`index.${language.fileExtension}\``, async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );
          const indexFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/index.${language.fileExtension}`,
            'utf-8',
          );

          expect(dotEnvFile).toContain(
            'FOREST_SERVER_URL=http://localhost:3001\n# This should be removed in production environment.\nNODE_TLS_REJECT_UNAUTHORIZED=0',
          );
          expect(indexFile).toContain('forestServerUrl: process.env.FOREST_SERVER_URL');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });

        it('should set `forestExtraHost` in `docker-compose.yml`', async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
            'utf-8',
          );

          expect(dockerComposeFile).toContain('extra_hosts:');
          expect(dockerComposeFile).toContain('- localhost:host-gateway');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });
      });

      describe('without a FOREST_SERVER_URL', () => {
        const setupAndDump = async () => {
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: 'postgres://localhost:54369',
              dbSsl: false,
              dbSchema: 'public',
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext: any = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs({
            ...injectedContext,
            env: {
              ...injectedContext.env,
              FOREST_URL_IS_DEFAULT: true,
            },
          });
          await dumper.dump(postgresConfig, {});

          return postgresConfig;
        };

        it(`should not set \`forestServerURl\` in \`.env\` and \`index.${language.fileExtension}\``, async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );
          const indexFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/index.${language.fileExtension}`,
            'utf-8',
          );

          expect(dotEnvFile).not.toContain(
            'FOREST_SERVER_URL=http://localhost:3001\n# This should be removed in production environment.\nNODE_TLS_REJECT_UNAUTHORIZED=0',
          );
          expect(indexFile).not.toContain('forestServerUrl: process.env.FOREST_SERVER_URL');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });

        it('should not set `forestExtraHost` in `docker-compose.yml`', async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const dockerComposeFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/docker-compose.yml`,
            'utf-8',
          );

          expect(dockerComposeFile).not.toContain('extra_hosts:');
          expect(dockerComposeFile).not.toContain('- localhost:host-gateway');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });
      });

      describe('without a schema', () => {
        const setupAndDump = async () => {
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: 'postgres://localhost:54369',
              dbSsl: false,
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext: any = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs({
            ...injectedContext,
          });
          await dumper.dump(postgresConfig, {});

          return postgresConfig;
        };

        it(`should not set \`DATABASE_SCHEMA\` in \`.env\` and \`index.${language.fileExtension}\``, async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const indexFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/index.${language.fileExtension}`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );

          expect(dotEnvFile).not.toContain('DATABASE_SCHEMA=');
          expect(indexFile).not.toContain('schema: process.env.DATABASE_SCHEMA');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });
      });

      describe('with a schema', () => {
        const setupAndDump = async () => {
          const postgresConfig: Config = {
            appConfig: {
              appName: 'test-output/postgres',
              appHostname: 'localhost',
              appPort: 1654,
            },
            dbConfig: {
              dbDialect: 'postgres',
              dbConnectionUrl: 'postgres://localhost:54369',
              dbSsl: false,
              dbSchema: 'aSchema',
            },
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
            language,
          };
          const injectedContext: any = Context.execute(defaultPlan);
          const dumper = new AgentNodeJs({
            ...injectedContext,
          });
          await dumper.dump(postgresConfig, {});

          return postgresConfig;
        };

        it(`should set \`DATABASE_SCHEMA\` in \`.env\`, \`index.${language.fileExtension}\``, async () => {
          expect.assertions(2);

          const postgresConfig = await setupAndDump();
          const indexFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/index.${language.fileExtension}`,
            'utf-8',
          );
          const dotEnvFile = fs.readFileSync(
            `${appRoot}/${postgresConfig.appConfig.appName}/.env`,
            'utf-8',
          );

          expect(dotEnvFile).toContain('DATABASE_SCHEMA=aSchema');
          expect(indexFile).toContain('schema: process.env.DATABASE_SCHEMA');

          rimraf.sync(`${appRoot}/${postgresConfig.appConfig.appName}`);
        });
      });
    });
  });
});
