import type { ConfigInterface } from '../../../src/interfaces/project-create-interface';

import AgentNodeJsDumper from '../../../src/services/dumper/agent-nodejs-dumper';

describe('services > agentNodejsDumper', () => {
  const createDumper = (dependencies = {}) => {
    const context = {
      assertPresent: jest.fn(),
      env: {
        FOREST_URL: undefined,
      },
      isLinuxOs: false,
      fs: {
        existsSync: jest.fn().mockReturnValue(false),
        writeFileSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn(),
      },
      chalk: {
        green: jest.fn(),
        yellow: jest.fn(),
      },
      Handlebars: {
        compile: jest.fn().mockImplementation(() => variables => variables),
      },
      mkdirp: jest.fn(),
      buildDatabaseUrl: jest.fn(() => 'localhost'),
      constants: {
        CURRENT_WORKING_DIRECTORY: '/test',
      },
      logger: {
        log: jest.fn(),
      },
      ...dependencies,
    };

    const defaultConfig: ConfigInterface = {
      appConfig: {
        appPort: null,
        appHostname: 'http://localhost',
        applicationName: 'anApplication',
      },
      dbConfig: {
        ssl: false,
        dbSchema: 'public',
        dbPort: 5432,
        dbPassword: 'aPassword',
        dbDialect: 'sql',
        dbUser: 'aUser',
        dbName: 'aDatabase',
        dbHostname: 'localhost',
      },
      forestEnvSecret: 'aForestEnvSecret',
      forestAuthSecret: 'aForestAuthSecret',
    };

    return {
      dumper: new AgentNodeJsDumper(context),
      context,
      defaultConfig,
    };
  };

  describe('when writing common files', () => {
    it('should write a .gitignore file', async () => {
      expect.assertions(1);

      const { dumper, context, defaultConfig } = createDumper();

      await dumper.dump(defaultConfig);

      expect(context.fs.writeFileSync).toHaveBeenCalledWith(
        '/test/anApplication/.gitignore',
        'node_modules\n.env',
      );
    });
  });

  describe('when writing .env file', () => {
    describe('when handling basic attributes', () => {
      it('should handle required attributes', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper();

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith('/test/anApplication/.env', {
          databaseUrl: 'localhost',
          ssl: false,
          dbSchema: 'public',
          port: 3310,
          forestEnvSecret: 'aForestEnvSecret',
          forestAuthSecret: 'aForestAuthSecret',
          hasDockerDatabaseUrl: true,
          dockerDatabaseUrl: 'host.docker.internal',
        });
      });
    });

    describe('when handling application port', () => {
      describe('when application port has not been provided', () => {
        it('should use the default port', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/.env',
            expect.objectContaining({
              port: 3310,
            }),
          );
        });
      });

      describe('when application port has been provided', () => {
        it('should use the port povided', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          defaultConfig.appConfig.appPort = 3000;

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/.env',
            expect.objectContaining({
              port: 3000,
            }),
          );
        });
      });
    });

    describe('when handling ssl', () => {
      describe('when ssl is not provided', () => {
        it('should set ssl to false', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          defaultConfig.dbConfig.ssl = null;

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/.env',
            expect.objectContaining({
              ssl: false,
            }),
          );
        });
      });

      describe('when ssl is provided', () => {
        describe('when ssl is true', () => {
          it('should specify to use SSL', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper();

            defaultConfig.dbConfig.ssl = true;
            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              '/test/anApplication/.env',
              expect.objectContaining({
                ssl: true,
              }),
            );
          });
        });

        describe('when ssl is false', () => {
          it('should specify to not use SSL', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper();

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              '/test/anApplication/.env',
              expect.objectContaining({
                ssl: false,
              }),
            );
          });
        });
      });
    });

    describe('when handling OS', () => {
      describe('when on Linux OS', () => {
        it('should set appropriate docker database URL', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper({
            isLinuxOs: true,
          });

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/.env',
            expect.objectContaining({
              dockerDatabaseUrl: undefined,
              hasDockerDatabaseUrl: false,
            }),
          );
        });
      });

      describe('when not on Linux OS', () => {
        it('should set appropriate docker database URL', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/.env',
            expect.objectContaining({
              dockerDatabaseUrl: 'host.docker.internal',
              hasDockerDatabaseUrl: true,
            }),
          );
        });
      });
    });
  });

  describe('when writing index.js file', () => {
    describe('when handling FOREST_URL', () => {
      describe('when FOREST_URL has been provided', () => {
        it('should set forestUrl', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper({
            env: {
              FOREST_URL: 'http://localhost:3001',
            },
          });

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/index.js',
            expect.objectContaining({
              forestUrl: 'http://localhost:3001',
            }),
          );
        });
      });

      describe('when FOREST_URL has not been provided', () => {
        it('should not set forestUrl', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/index.js',
            expect.objectContaining({
              forestUrl: undefined,
            }),
          );
        });
      });
    });

    describe('when handling datasource', () => {
      describe('when dbDialect is mongodb', () => {
        it('should use mongoose data source', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          defaultConfig.dbConfig.dbDialect = 'mongodb';

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/index.js',
            expect.objectContaining({
              datasourceImport: `const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');\nconst models = require('./models');`,
              datasourceCreation: 'createMongooseDataSource(models.connections.default, {}), {});',
            }),
          );
        });
      });
      describe('when dbDialect is not mongodb', () => {
        it('should use sql data source', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/index.js',
            expect.objectContaining({
              datasourceImport: `const { createSqlDataSource } = require('@forestadmin/datasource-sql');`,
              datasourceCreation: 'createSqlDataSource(process.env.DATABASE_URL)',
            }),
          );
        });
      });
    });
  });

  describe('when writing package.json', () => {
    describe('when handling basic attributes', () => {
      it('should write basic attributes with adequate configuration', async () => {
        expect.assertions(6);

        const { dumper, context, defaultConfig } = createDumper();

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"name": "anapplication"'),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"start": "node ./index.js"'),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"version": "0.0.1"'),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"private": true'),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"@forestadmin/agent": "^1.0.0"'),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          '/test/anApplication/package.json',
          expect.stringContaining('"nodenv": "^16.0.1"'),
        );
      });
    });

    describe('when handling datasource', () => {
      describe('when the dbDialect is mongodb', () => {
        it('should use the mongoose datasource package', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          defaultConfig.dbConfig.dbDialect = 'mongodb';

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/package.json',
            expect.stringContaining('"@forestadmin/datasource-mongoose": "^1.0.0"'),
          );
        });
      });

      describe('when the dbDialect is not mongodb', () => {
        it('should use the mongoose datasource package', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper();

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            '/test/anApplication/package.json',
            expect.stringContaining('"@forestadmin/datasource-sql": "^1.0.0"'),
          );
        });

        describe('when dbDialect requires additional dependency', () => {
          it('should add pg for postgresql', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper();

            defaultConfig.dbConfig.dbDialect = 'postgres';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              '/test/anApplication/package.json',
              expect.stringContaining('"pg": "~8.2.2"'),
            );
          });

          it('should add mysql2 for mysql', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper();

            defaultConfig.dbConfig.dbDialect = 'mysql';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              '/test/anApplication/package.json',
              expect.stringContaining('"mysql2": "~2.2.5"'),
            );
          });

          it('should add tedious for mssql', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper();

            defaultConfig.dbConfig.dbDialect = 'mssql';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              '/test/anApplication/package.json',
              expect.stringContaining('"tedious": "^6.4.0"'),
            );
          });
        });
      });
    });
  });
});
