/* eslint-disable jest/max-nested-describe */
import type { Config } from '../../../../src/interfaces/project-create-interface';
import type { Language } from '../../../../src/utils/languages';

import AgentNodeJs from '../../../../src/services/dumpers/agent-nodejs';
import languages from '../../../../src/utils/languages';

describe('services > dumpers > AgentNodeJs', () => {
  const createDumper = (language: Language, dependencies = {}) => {
    const schemaSample = {
      collectionA: {
        fields: [
          {
            field: 'aField',
            ref: 'a-collection',
          },
        ],
        options: {
          timestamps: true,
        },
      },
      collectionB: {
        fields: [],
        options: {
          timestamps: false,
        },
      },
      'collection-c': {
        fields: [],
        options: {
          timestamps: true,
        },
      },
    };

    const context = {
      assertPresent: jest.fn(),
      env: {
        FOREST_SERVER_URL: undefined,
        FOREST_URL_IS_DEFAULT: true,
      },
      isLinuxOs: false,
      fs: {
        existsSync: jest.fn().mockReturnValue(false),
        writeFileSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue('mockedContent'),
      },
      chalk: {
        green: jest.fn(),
        yellow: jest.fn(),
      },
      Handlebars: {
        compile: jest.fn().mockImplementation(() => variables => variables),
      },
      lodash: {
        snakeCase: jest.fn().mockImplementation(name => name),
        kebabCase: jest.fn().mockImplementation(name => name),
      },
      strings: {
        transformToCamelCaseSafeString: jest.fn().mockImplementation(name => name),
      },
      mkdirp: jest.fn(),
      buildDatabaseUrl: jest.fn(() => 'localhost'),
      isDatabaseLocal: jest.fn(() => true),
      constants: {
        CURRENT_WORKING_DIRECTORY: '/test',
      },
      toValidPackageName: jest.fn().mockImplementation(string => string),
      logger: {
        log: jest.fn(),
      },
      ...dependencies,
    };

    const defaultConfig: Config = {
      appConfig: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        appPort: null,
        appHostname: 'http://localhost',
        appName: `a${language.name}Application`,
      },
      dbConfig: {
        dbSsl: false,
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
      language,
    };

    return {
      dumper: new AgentNodeJs(context),
      context,
      defaultConfig,
      schemaSample,
    };
  };

  describe.each([languages.Javascript, languages.Typescript])('when dumping in $name', language => {
    describe('when writing common files', () => {
      it('should write a .gitignore file', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/.gitignore`,
          `node_modules\n.env\n${language === languages.Typescript ? 'dist\n' : ''}`,
        );
      });

      it('should write a .dockerignore file', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/.dockerignore`,
          `node_modules\nnpm-debug.log\n.env\n${language === languages.Typescript ? 'dist\n' : ''}`,
        );
      });

      it('should write a typings.ts file', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/typings.ts`,
          '/* eslint-disable */\nexport type Schema = any;\n',
        );
      });

      it('should write a Dockerfile', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/Dockerfile`,
          'mockedContent',
        );
      });
    });

    describe('when writing .env file', () => {
      describe('when handling basic attributes', () => {
        it('should handle required attributes', async () => {
          expect.assertions(1);

          const { dumper, context, defaultConfig } = createDumper(language);

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/.env`,
            {
              dbUrl: 'localhost',
              dbSsl: false,
              dbSchema: 'public',
              appPort: 3310,
              forestServerUrl: false,
              forestEnvSecret: 'aForestEnvSecret',
              forestAuthSecret: 'aForestAuthSecret',
              hasDockerDbUrl: true,
              dockerDbUrl: 'host.docker.internal',
            },
          );
        });
      });

      describe('when handling application port', () => {
        describe('when application port has not been provided', () => {
          it('should use the default port', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                appPort: 3310,
              }),
            );
          });
        });

        describe('when application port has been provided', () => {
          it('should use the appPort provided', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.appConfig.appPort = 3000;

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                appPort: 3000,
              }),
            );
          });
        });
      });

      describe('when handling ssl', () => {
        describe('when ssl is not provided', () => {
          it('should set ssl to false', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            defaultConfig.dbConfig.dbSsl = null;

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                dbSsl: false,
              }),
            );
          });
        });

        describe('when ssl is provided', () => {
          describe('when ssl is true', () => {
            it('should specify to use SSL', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              defaultConfig.dbConfig.dbSsl = true;
              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/.env`,
                expect.objectContaining({
                  dbSsl: true,
                }),
              );
            });
          });

          describe('when ssl is false', () => {
            it('should specify to not use SSL', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/.env`,
                expect.objectContaining({
                  dbSsl: false,
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

            const { dumper, context, defaultConfig } = createDumper(language, {
              isLinuxOs: true,
            });

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                dockerDbUrl: '',
                hasDockerDbUrl: false,
              }),
            );
          });
        });

        describe('when not on Linux OS', () => {
          it('should set appropriate docker database URL', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                dockerDbUrl: 'host.docker.internal',
                hasDockerDbUrl: true,
              }),
            );
          });
        });
      });

      describe('when handling FOREST_SERVER_URL', () => {
        describe('when FOREST_SERVER_URL has been provided', () => {
          it('should set forestServerUrl to actual value', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language, {
              env: {
                FOREST_SERVER_URL: 'https://api.development.forestadmin.com',
                FOREST_URL_IS_DEFAULT: false,
              },
            });

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                forestServerUrl: 'https://api.development.forestadmin.com',
              }),
            );
          });
        });

        describe('when FOREST_SERVER_URL has not been provided', () => {
          it('should not set forestServerUrl', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                forestServerUrl: false,
              }),
            );
          });
        });
      });
    });

    describe(`when writing index.${language.fileExtension} file`, () => {
      describe('when handling FOREST_SERVER_URL', () => {
        describe('when FOREST_SERVER_URL has been provided', () => {
          it('should set forestServerUrl to true', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language, {
              env: {
                FOREST_SERVER_URL: 'http://localhost:3001',
                FOREST_URL_IS_DEFAULT: false,
              },
            });

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/index.${language.fileExtension}`,
              expect.objectContaining({
                forestServerUrl: 'http://localhost:3001',
              }),
            );
          });
        });

        describe('when FOREST_SERVER_URL has not been provided', () => {
          it('should not set forestServerUrl to false', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/index.${language.fileExtension}`,
              expect.objectContaining({
                forestServerUrl: false,
              }),
            );
          });
        });
      });

      describe.skip('when handling datasource', () => {
        describe('when dbDialect is mongodb', () => {
          it('should use mongoose data source with flattener auto', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mongodb';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/index.${language.fileExtension}`,
              expect.objectContaining({
                isMongoose: true,
                isMySQL: false,
                isMSSQL: false,
                dbSchema: undefined,
              }),
            );
          });
        });

        describe('when dbDialect is not mongodb', () => {
          it('should use sql data source', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mysql';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/index.${language.fileExtension}`,
              expect.objectContaining({
                isMongoose: false,
                isMySQL: true,
                isMSSQL: false,
                datasourceCreation: `
    createSqlDataSource({
      uri: process.env.DATABASE_URL,
      schema: process.env.DATABASE_SCHEMA,
      dialectOptions,
    }),
  `,
                datasourceImport:
                  language === languages.Javascript
                    ? "const { createSqlDataSource } = require('@forestadmin/datasource-sql');"
                    : "import { createSqlDataSource } from '@forestadmin/datasource-sql';",
              }),
            );
          });
        });
      });
    });

    describe('when writing package.json', () => {
      describe('when handling basic attributes', () => {
        it('should write basic attributes with adequate configuration', async () => {
          expect.assertions(9);

          const { dumper, context, defaultConfig } = createDumper(language);

          await dumper.dump(defaultConfig);

          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining(`"name": "a${language.name}Application"`),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining(`"start": "nodemon ./index.${language.fileExtension}"`),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining(
              `"start:agent": "node ./${language === languages.Typescript ? 'dist/' : ''}index.js"`,
            ),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('"version": "0.0.1"'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('"private": true'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('"@forestadmin/agent": "^1.0.0"'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('"dotenv": "^16.0.1"'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('"nodemon": "^2.0.12"'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('nodemonConfig'),
          );
        });
      });

      describe('when handling datasource', () => {
        describe('when the dbDialect is mongodb', () => {
          it('should use the mongoose datasource package', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mongodb';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/package.json`,
              expect.stringContaining('"@forestadmin/datasource-mongoose": "^1.0.0"'),
            );
          });

          it('should add mongoose dependency', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mongodb';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/package.json`,
              expect.stringContaining('"mongoose": "^6.10.3"'),
            );
          });
        });

        describe('when the dbDialect is not mongodb', () => {
          it('should use the sql datasource package', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/package.json`,
              expect.stringContaining('"@forestadmin/datasource-sql": "^1.0.0"'),
            );
          });

          describe('when dbDialect requires additional dependency', () => {
            it('should add pg for postgresql', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'postgres';

              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/package.json`,
                expect.stringContaining('"pg": "^8.8.0"'),
              );
            });

            it('should add mysql2 for mysql', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mysql';

              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/package.json`,
                expect.stringContaining('"mysql2": "^3.0.1"'),
              );
            });

            it('should add mariadb for mariadb', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mariadb';

              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/package.json`,
                expect.stringContaining('"mariadb": "^3.0.2"'),
              );
            });

            it('should add tedious for mssql', async () => {
              expect.assertions(1);

              const { dumper, context, defaultConfig } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mssql';

              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/package.json`,
                expect.stringContaining('"tedious": "^15.1.2"'),
              );
            });
          });
        });
      });
    });

    describe('when writing docker-compose.yml', () => {
      it('should write docker-compose.yml with adequate configuration', async () => {
        expect.assertions(1);

        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/docker-compose.yml`,
          expect.objectContaining({
            containerName: `a${language.name}Application`,
            forestExtraHost: '',
            isLinuxOs: false,
            network: null,
          }),
        );
      });

      describe('when the FOREST_SERVER_URL is invalid', () => {
        it('should throw an error', async () => {
          expect.assertions(1);

          const { dumper, defaultConfig } = createDumper(language, {
            env: {
              FOREST_SERVER_URL: 'invalidUrl',
              FOREST_URL_IS_DEFAULT: false,
            },
          });
          await expect(dumper.dump(defaultConfig)).rejects.toThrow(
            'Invalid value for FOREST_SERVER_URL: "invalidUrl"',
          );
        });
      });
    });

    describe('when handling mongoSchema', () => {
      describe('when schema is empty', () => {
        it('should not write models nor index', async () => {
          expect.assertions(1);

          const { defaultConfig, dumper, context } = createDumper(language);

          defaultConfig.dbConfig.dbDialect = 'mongodb';

          await dumper.dump(defaultConfig);

          expect(context.mkdirp).not.toHaveBeenCalledWith(
            `/test/a${language.name}Application/models`,
          );
        });
      });

      describe('when schema is not empty', () => {
        describe('when dbDialect is mongodb', () => {
          it('should create models directory', async () => {
            expect.assertions(1);

            const { defaultConfig, dumper, context } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mongodb';

            await dumper.dump(defaultConfig, {});

            expect(context.mkdirp).toHaveBeenCalledWith(
              `/test/a${language.name}Application/models`,
            );
          });

          describe('when schema does not have any models', () => {
            it('should write only the index file', async () => {
              expect.assertions(2);

              const { defaultConfig, dumper, context } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              await dumper.dump(defaultConfig, {});

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/index.${language.fileExtension}`,
                'mockedContent',
              );

              expect(context.fs.writeFileSync).toHaveBeenCalledTimes(9);
            });
          });

          describe('when schema does have models', () => {
            it('should write as many files as models', async () => {
              expect.assertions(3);

              const { defaultConfig, dumper, context, schemaSample } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              await dumper.dump(defaultConfig, schemaSample);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionA.${language.fileExtension}`,
                expect.objectContaining({
                  collectionName: 'collectionA',
                }),
              );

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionB.${language.fileExtension}`,
                expect.objectContaining({
                  collectionName: 'collectionB',
                }),
              );

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collection-c.${language.fileExtension}`,
                expect.objectContaining({
                  collectionName: 'collection-c',
                }),
              );
            });

            it('should compute a safe camel cased model name', async () => {
              expect.assertions(2);

              const { defaultConfig, dumper, context, schemaSample } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              context.strings.transformToCamelCaseSafeString.mockImplementation(
                name => `${name}camelCased`,
              );

              await dumper.dump(defaultConfig, schemaSample);

              expect(context.strings.transformToCamelCaseSafeString).toHaveBeenCalledWith(
                'collection-c',
              );
              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collection-c.${language.fileExtension}`,
                expect.objectContaining({
                  modelName: 'collection-ccamelCased',
                }),
              );
            });

            it('should pass adequate configuration', async () => {
              expect.assertions(3);

              const { defaultConfig, dumper, context, schemaSample } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              await dumper.dump(defaultConfig, schemaSample);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collection-c.${language.fileExtension}`,
                {
                  modelName: 'collection-c',
                  collectionName: 'collection-c',
                  fields: [],
                  timestamps: true,
                },
              );
              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionA.${language.fileExtension}`,
                {
                  modelName: 'collectionA',
                  collectionName: 'collectionA',
                  fields: [
                    {
                      field: 'aField',
                      ref: 'a-collection',
                    },
                  ],
                  timestamps: true,
                },
              );
              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionB.${language.fileExtension}`,
                {
                  modelName: 'collectionB',
                  collectionName: 'collectionB',
                  fields: [],
                  timestamps: false,
                },
              );
            });

            it('should should compute safe camel cased references', async () => {
              expect.assertions(2);

              const { defaultConfig, dumper, context, schemaSample } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              context.strings.transformToCamelCaseSafeString.mockImplementation(
                name => `${name}camelCased`,
              );

              await dumper.dump(defaultConfig, schemaSample);

              expect(context.strings.transformToCamelCaseSafeString).toHaveBeenCalledWith(
                'a-collection',
              );
              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionA.${language.fileExtension}`,
                {
                  modelName: 'collectionAcamelCased',
                  collectionName: 'collectionA',
                  fields: [
                    {
                      field: 'aField',
                      ref: 'a-collectioncamelCased',
                    },
                  ],
                  timestamps: true,
                },
              );
            });

            it('should compute kebab cased file name', async () => {
              expect.assertions(2);

              const { defaultConfig, dumper, context, schemaSample } = createDumper(language);

              defaultConfig.dbConfig.dbDialect = 'mongodb';

              context.lodash.kebabCase.mockImplementation(name => `${name}kebab_cased`);

              await dumper.dump(defaultConfig, schemaSample);

              expect(context.lodash.kebabCase).toHaveBeenCalledWith('collectionA');
              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/models/collectionAkebab_cased.${language.fileExtension}`,
                expect.objectContaining({
                  collectionName: 'collectionA',
                }),
              );
            });
          });
        });

        describe('when dbDialect is not mongodb', () => {
          it('should not write models nor index', async () => {
            expect.assertions(1);

            const { defaultConfig, dumper, context } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'postgres';

            await dumper.dump(defaultConfig);

            expect(context.mkdirp).not.toHaveBeenCalledWith(
              `/test/a${language.name}Application/models`,
            );
          });
        });
      });
    });
  });
});
