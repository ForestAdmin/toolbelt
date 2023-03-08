import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import fs from 'fs';
import os from 'os';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJs from '../../../../src/services/dumpers/agent-nodejs';

describe('services > dumpers > agentNodejs', () => {
  describe('dump', () => {
    const configs = [
      {
        name: 'mongodb',
        appConfig: {
          applicationName: 'test-output/mongodb',
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mongodb',
          dbConnectionUrl: 'mongodb://localhost:27016',
          ssl: false,
          dbSchema: 'public',
        },
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
      },
      {
        name: 'postgres',
        appConfig: {
          applicationName: 'test-output/postgres',
          appHostname: 'localhost',
          appPort: 1654,
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
        },
        dbConfig: {
          dbDialect: 'mysql',
          dbConnectionUrl: 'mysql://localhost:8999',
          ssl: false,
          dbSchema: 'public',
        },
      },
      {
        name: 'mariadb',
        appConfig: {
          applicationName: 'test-output/mariadb',
          appHostname: 'localhost',
          appPort: 1654,
        },
        dbConfig: {
          dbDialect: 'mariadb',
          dbConnectionUrl: 'mariadb://localhost:3305',
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
      'typings.ts',
      '.env',
      '.gitignore',
      '.dockerignore',
    ];

    describe.each(configs)('database $name', ({ name, appConfig, dbConfig }) => {
      async function dump() {
        const injectedContext = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs(injectedContext);
        await dumper.dump(
          {
            appConfig,
            dbConfig,
            forestAuthSecret: 'forestAuthSecret',
            forestEnvSecret: 'forestEnvSecret',
          },
          {},
        );
      }

      it.each(files)('should properly dump %s', async fileName => {
        expect.assertions(1);

        const osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');

        await dump();

        const generatedFile = fs.readFileSync(
          `${appRoot}/${appConfig.applicationName}/${fileName}`,
          'utf-8',
        );

        const expectedFile = fs.readFileSync(
          `${__dirname}/expected/${name}/${fileName === '.env' ? 'env' : fileName}`,
          'utf-8',
        );

        expect(generatedFile).toStrictEqual(expectedFile);
        rimraf.sync(`${appRoot}/${appConfig.applicationName}`);
        osStub.mockRestore();
      });
    });

    describe('on a linux based OS', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const osStub = jest.spyOn(os, 'platform').mockReturnValue('linux');
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
            dbSchema: 'public',
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
        };
        const injectedContext = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs(injectedContext);
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

    describe('on a non linux based OS', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const osStub = jest.spyOn(os, 'platform').mockReturnValue('darwin');
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
            dbSchema: 'public',
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
        };
        const injectedContext = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs(injectedContext);
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

    describe('with a FOREST_SERVER_URL', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
            dbSchema: 'public',
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
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

        return postgresConfig;
      };

      it('should set `forestServerURl` in `.env`, `docker-compose.yml` and `index.js`', async () => {
        expect.assertions(3);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );
        const dotEnvFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
          'utf-8',
        );
        const indexFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/index.js`,
          'utf-8',
        );

        expect(dotEnvFile).toContain(
          'FOREST_SERVER_URL=http://localhost:3001\n# This should be removed in production environment.\nNODE_TLS_REJECT_UNAUTHORIZED=0',
        );
        expect(dockerComposeFile).toContain(`- FOREST_SERVER_URL=\${FOREST_SERVER_URL}`);
        expect(indexFile).toContain('forestServerUrl: process.env.FOREST_SERVER_URL');

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });

      it('should set `forestExtraHost` in `docker-compose.yml`', async () => {
        expect.assertions(2);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );

        expect(dockerComposeFile).toContain('extra_hosts:');
        expect(dockerComposeFile).toContain('- localhost:host-gateway');

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });
    });

    describe('without a FOREST_SERVER_URL', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
            dbSchema: 'public',
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
        };
        const injectedContext: any = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs({
          ...injectedContext,
          env: {
            ...injectedContext.env,
            FOREST_URL_IS_DEFAULT: true,
          },
        });
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

        return postgresConfig;
      };

      it('should not set `forestServerURl` in `.env`, `docker-compose.yml` and `index.js`', async () => {
        expect.assertions(3);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );
        const dotEnvFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
          'utf-8',
        );
        const indexFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/index.js`,
          'utf-8',
        );

        expect(dotEnvFile).not.toContain(
          'FOREST_SERVER_URL=http://localhost:3001\n# This should be removed in production environment.\nNODE_TLS_REJECT_UNAUTHORIZED=0',
        );
        expect(dockerComposeFile).not.toContain(`- FOREST_SERVER_URL=\${FOREST_SERVER_URL}`);
        expect(indexFile).not.toContain('forestServerUrl: process.env.FOREST_SERVER_URL');

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });

      it('should not set `forestExtraHost` in `docker-compose.yml`', async () => {
        expect.assertions(2);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );

        expect(dockerComposeFile).not.toContain('extra_hosts:');
        expect(dockerComposeFile).not.toContain('- localhost:host-gateway');

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });
    });

    describe('without a schema', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
        };
        const injectedContext: any = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs({
          ...injectedContext,
        });
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

        return postgresConfig;
      };

      it('should not set `DATABASE_SCHEMA` in `.env`, `docker-compose.yml`', async () => {
        expect.assertions(2);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );
        const dotEnvFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
          'utf-8',
        );

        expect(dotEnvFile).not.toContain('DATABASE_SCHEMA=');
        expect(dockerComposeFile).not.toContain(`- DATABASE_SCHEMA=\${DATABASE_SCHEMA}`);

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });
    });

    describe('with a schema', () => {
      const setupAndDump = async (dbConnectionUrl: string | null = null) => {
        const postgresConfig = {
          appConfig: {
            applicationName: 'test-output/postgres',
            appHostname: 'localhost',
            appPort: 1654,
          },
          dbConfig: {
            dbDialect: 'postgres',
            dbConnectionUrl: 'postgres://localhost:54369',
            ssl: false,
            dbSchema: 'aSchema',
          },
          forestAuthSecret: 'forestAuthSecret',
          forestEnvSecret: 'forestEnvSecret',
        };
        const injectedContext: any = Context.execute(defaultPlan);
        const dumper = new AgentNodeJs({
          ...injectedContext,
        });
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

        return postgresConfig;
      };

      it('should set `DATABASE_SCHEMA` in `.env`, `docker-compose.yml`', async () => {
        expect.assertions(2);

        const postgresConfig = await setupAndDump();
        const dockerComposeFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/docker-compose.yml`,
          'utf-8',
        );
        const dotEnvFile = fs.readFileSync(
          `${appRoot}/${postgresConfig.appConfig.applicationName}/.env`,
          'utf-8',
        );

        expect(dotEnvFile).toContain('DATABASE_SCHEMA=aSchema');
        expect(dockerComposeFile).toContain(`- DATABASE_SCHEMA=\${DATABASE_SCHEMA}`);

        rimraf.sync(`${appRoot}/${postgresConfig.appConfig.applicationName}`);
      });
    });
  });
});
