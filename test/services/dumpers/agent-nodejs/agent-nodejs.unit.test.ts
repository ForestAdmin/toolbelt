/* eslint-disable jest/max-nested-describe */
import type { Config } from '../../../../src/interfaces/project-create-interface';
import type { Language } from '../../../../src/utils/languages';

import fs, { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

import AgentNodeJs from '../../../../src/services/dumpers/agent-nodejs';
import languages from '../../../../src/utils/languages';

/** A template folder tree for a mocked readdirSync: each folder's name, then its entries. */
const templateTree = (tree: Record<string, [string, boolean][]>) => (folder: string) =>
  (tree[folder.split('/').pop() as string] ?? []).map(([name, isDir]) => ({
    name,
    isDirectory: () => isDir,
  }));

describe('services > dumpers > AgentNodeJs', () => {
  const createDumper = (language: Language, dependencies = {}) => {
    const schemaSample = {
      collectionA: {
        fields: [
          {
            name: 'aField',
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
        dbSslMode: 'disabled',
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

  describe.each([languages.Javascript, languages.Typescript])(
    'when dumping a demo project in $name (isDemo)',
    language => {
      const demoConfig = (base: Config): Config => ({ ...base, isDemo: true });

      it('uses the demo-bank datasource dependency, not sql', async () => {
        expect.assertions(2);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        const pkgCall = context.fs.writeFileSync.mock.calls.find(([p]: [string]) =>
          p.endsWith('package.json'),
        );
        expect(pkgCall[1]).toContain('@forestadmin/datasource-demo-bank');
        expect(pkgCall[1]).not.toContain('@forestadmin/datasource-sql');
      });

      it('lets npm run the SQLite driver install script', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        const pkgCall = context.fs.writeFileSync.mock.calls.find(([p]: [string]) =>
          p.endsWith('package.json'),
        );
        expect(JSON.parse(pkgCall[1]).allowScripts).toStrictEqual({ sqlite3: true });
      });

      it('depends on express, which serves the Custom components', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        const pkgCall = context.fs.writeFileSync.mock.calls.find(([p]: [string]) =>
          p.endsWith('package.json'),
        );
        expect(JSON.parse(pkgCall[1]).dependencies.express).toStrictEqual(expect.any(String));
      });

      it('copies the Custom components the agent serves', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);
        context.fs.existsSync.mockImplementation((p: string) =>
          p.endsWith('/common/components/hub'),
        );
        Object.assign(context.fs, {
          readdirSync: jest.fn().mockReturnValue(['go-to.js']),
          mkdirSync: jest.fn(),
        });

        await dumper.dump(demoConfig(defaultConfig));

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/public/smart-components/hub/go-to.js`,
          'mockedContent',
        );
      });

      it('copies the partner portals byte for byte, sub-folders included, uploads left out', async () => {
        expect.assertions(4);
        const { dumper, context, defaultConfig } = createDumper(language);
        const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xe9]);
        context.fs.existsSync.mockImplementation((p: string) => p.includes('/common/portals'));
        context.fs.readFileSync.mockImplementation((p: string) =>
          p.endsWith('.pdf') ? pdf : 'mockedContent',
        );
        Object.assign(context.fs, {
          readdirSync: jest.fn().mockImplementation(
            templateTree({
              portals: [['partner-portal', true]],
              'partner-portal': [
                ['server.js', false],
                ['samples', true],
                ['uploads', true],
              ],
              samples: [['passport.pdf', false]],
              uploads: [['a-visitor-upload', false]],
            }),
          ),
          mkdirSync: jest.fn(),
        });

        await dumper.dump(demoConfig(defaultConfig));

        const project = `/test/a${language.name}Application`;
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `${project}/portals/partner-portal/samples/passport.pdf`,
          pdf,
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `${project}/portals/partner-portal/server.js`,
          'mockedContent',
        );
        expect(
          context.fs.writeFileSync.mock.calls.some(([target]: [string]) =>
            target.includes('/uploads/'),
          ),
        ).toBe(false);
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `${project}/.gitignore`,
          `node_modules\n.env\n${
            language === languages.Typescript ? 'dist\n' : ''
          }portals/partner-portal/uploads\n`,
        );
      });

      it('passes isDemo to the index and .env templates', async () => {
        expect.assertions(2);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/index.${language.fileExtension}`,
          expect.objectContaining({ isDemo: true }),
        );
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/.env`,
          expect.objectContaining({ isDemo: true }),
        );
      });

      it('does not write a docker-compose file (no database)', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        expect(context.fs.writeFileSync).not.toHaveBeenCalledWith(
          `/test/a${language.name}Application/docker-compose.yml`,
          expect.anything(),
        );
      });

      it('writes the pre-configured forest-layout.json', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          `/test/a${language.name}Application/forest-layout.json`,
          'mockedContent',
        );
      });
    },
  );

  describe.each([languages.Javascript, languages.Typescript])('when dumping in $name', language => {
    describe('when writing common files', () => {
      it('does not write a forest-layout.json (only demo projects ship a layout)', async () => {
        expect.assertions(1);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(defaultConfig);

        expect(context.fs.writeFileSync).not.toHaveBeenCalledWith(
          `/test/a${language.name}Application/forest-layout.json`,
          expect.anything(),
        );
      });

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
              isDemo: false,
              dbUrl: 'localhost',
              dbSslMode: 'disabled',
              dbSchema: 'public',
              appPort: 3310,
              forestServerUrl: false,
              forestEnvSecret: 'aForestEnvSecret',
              forestAuthSecret: 'aForestAuthSecret',
              hasDockerDbUrl: true,
              dockerDbUrl: 'host.docker.internal',
              isMongo: false,
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
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            defaultConfig.dbConfig.dbSslMode = null;

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/.env`,
              expect.objectContaining({
                dbSslMode: 'disabled',
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
              defaultConfig.dbConfig.dbSslMode = 'preferred';
              await dumper.dump(defaultConfig);

              expect(context.fs.writeFileSync).toHaveBeenCalledWith(
                `/test/a${language.name}Application/.env`,
                expect.objectContaining({
                  dbSslMode: 'preferred',
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
                  dbSslMode: 'disabled',
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
            expect.stringContaining(`"start:watch": "nodemon ./index.${language.fileExtension}"`),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining(
              `"start": "node ./${language === languages.Typescript ? 'dist/' : ''}index.js"`,
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
            expect.stringContaining('"nodemon": "^3.1.10"'),
          );
          expect(context.fs.writeFileSync).toHaveBeenCalledWith(
            `/test/a${language.name}Application/package.json`,
            expect.stringContaining('nodemonConfig'),
          );
        });
      });

      describe('when handling datasource', () => {
        describe('when the dbDialect is mongodb', () => {
          it('should use the mongo datasource package', async () => {
            expect.assertions(1);

            const { dumper, context, defaultConfig } = createDumper(language);

            defaultConfig.dbConfig.dbDialect = 'mongodb';

            await dumper.dump(defaultConfig);

            expect(context.fs.writeFileSync).toHaveBeenCalledWith(
              `/test/a${language.name}Application/package.json`,
              expect.stringContaining('"@forestadmin/datasource-mongo": "^1.0.0"'),
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
                expect.stringContaining('"tedious": "^18.6.1"'),
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
  });
});

describe('demo forest-layout.json asset', () => {
  // Guards on the bundled demo bank layout: valid JSON, no project of its own, and consistent with the
  // @forestadmin/datasource-demo-bank schema (the version pinned in
  // src/services/dumpers/agent-nodejs.ts): datasource-demo-bank-schema.json lists its collections,
  // relations and Smart Action endpoints, as its agent describes them.
  const file = path.join(
    __dirname,
    '../../../../src/services/dumpers/templates/agent-nodejs/common/forest-layout.json',
  );
  const schema = JSON.parse(
    readFileSync(path.join(__dirname, 'datasource-demo-bank-schema.json'), 'utf8'),
  ) as {
    collections: string[];
    relations: Record<string, string[]>;
    actions: Record<string, Record<string, string>>;
  };
  const read = () => JSON.parse(readFileSync(file, 'utf8'));

  /** Depth-first walk yielding every object of the parsed JSON tree. */
  function* walkObjects(node: unknown): Generator<Record<string, unknown>> {
    if (Array.isArray(node)) {
      // eslint-disable-next-line no-restricted-syntax
      for (const child of node) yield* walkObjects(child);
    } else if (node && typeof node === 'object') {
      yield node as Record<string, unknown>;
      // eslint-disable-next-line no-restricted-syntax
      for (const child of Object.values(node)) yield* walkObjects(child);
    }
  }

  it('is valid JSON declaring only collections of the demo bank', () => {
    expect.hasAssertions();
    const collectionIds = (read().layout?.collections ?? []).map(
      (collection: { id: string }) => collection.id,
    );

    expect(collectionIds.length).toBeGreaterThan(0);
    collectionIds.forEach((id: string) => expect(schema.collections).toContain(id));
  });

  it('names no project, environment or machine of its own', () => {
    expect.assertions(6);
    const raw = readFileSync(file, 'utf8');
    const layout = JSON.parse(raw);

    // The `forest` header is required by `layout apply` but is provenance-only.
    expect(layout.forest.project.id).toBe(0);
    expect(layout.forest.environment.id).toBe(0);
    expect(layout.forest.team.id).toBe(0);
    // Custom components load their files from the environment's agent (relative URLs), never
    // from one machine.
    expect(raw).not.toMatch(/localhost:\d+\//);
    // A link to one project's workspace, or an inbox automated as one project's service account.
    expect(raw).not.toMatch(/app\.forestadmin\.com\/[^/"]+\/[^/"]+\/[^/"]+\/workspaces\//);
    expect(raw).not.toMatch(/"serviceAccountUserId":\s*\d+/);
  });

  it('only references collections of the demo bank in folders', () => {
    expect.hasAssertions();
    const referenced = [...walkObjects(read().folders)]
      .filter(node => node.type === 'collection')
      .map(node => node.id as string);

    expect(referenced.length).toBeGreaterThan(0);
    referenced.forEach(id => expect(schema.collections).toContain(id));
  });

  it('only uses relation names that exist in the demo bank', () => {
    expect.hasAssertions();
    const layout = read();
    // Summary views: `has-many` blocks reference a relation of their collection.
    const refs = (layout.layout?.collections ?? []).flatMap(
      (collection: { id: string; layout: { viewEdit?: { summaryView?: unknown } } }) =>
        [...walkObjects(collection.layout?.viewEdit?.summaryView)]
          .filter(node => String(node.type).endsWith('/has-many'))
          .map(node => [collection.id, (node.data as { name: string }).name]),
    );
    // Workspace components: a filter condition with a subFieldName goes through a relation.
    [...walkObjects(layout.layout?.workspaces)]
      .filter(node => typeof (node.collectionId ?? node.sourceCollectionId) === 'string')
      .filter(node => node.filter)
      .forEach(node =>
        [...walkObjects(node.filter)]
          .filter(condition => condition.subFieldName && condition.fieldName)
          .forEach(condition =>
            refs.push([node.collectionId ?? node.sourceCollectionId, condition.fieldName]),
          ),
      );

    expect(refs.length).toBeGreaterThan(0);
    refs.forEach(([collectionId, name]) => expect(schema.relations[collectionId]).toContain(name));
  });

  it('calls each Smart Action at the endpoint the demo bank serves it on', () => {
    expect.hasAssertions();
    (read().layout?.collections ?? []).forEach(
      (collection: {
        id: string;
        layout: { actions?: Array<{ endpoint: string; name: string }> };
      }) =>
        (collection.layout.actions ?? []).forEach(action =>
          expect(action.endpoint).toBe(schema.actions[collection.id]?.[action.name]),
        ),
    );
  });

  it('loads each Custom component file from the agent, which serves the components it ships', () => {
    expect.hasAssertions();
    const raw = readFileSync(file, 'utf8');
    const urls = [...raw.matchAll(/"(?:component|template|style)Url": "([^"]*)"/g)].map(
      ([, url]) => url,
    );

    const base = '/public/smart-components/';

    expect(urls.length).toBeGreaterThan(0);
    // A relative URL: the Forest app fetches it from the environment's agent.
    urls.forEach(url => expect(url.startsWith(base)).toBe(true));
    new Set(urls.map(url => url.split('?')[0].slice(base.length))).forEach(name =>
      expect(existsSync(path.join(path.dirname(file), 'components', name))).toBe(true),
    );
    // The demo's agent serves the project's public/ folder (the dumper copies them into it).
    ['javascript', 'typescript'].forEach(language =>
      expect(
        readFileSync(path.join(path.dirname(file), '..', language, 'index.hbs'), 'utf8'),
      ).toContain("app.use(\n  '/public',"),
    );
  });

  it('tells the workflow executor where the demo agent answers, as it runs on express', () => {
    expect.hasAssertions();
    ['javascript', 'typescript'].forEach(language =>
      expect(
        readFileSync(path.join(path.dirname(file), '..', language, 'index.hbs'), 'utf8'),
      ).toContain('agentUrl: `http://localhost:'),
    );
  });

  it('turns the Gateway on only once @forestadmin/agent-bff is installed', () => {
    expect.hasAssertions();
    ['javascript', 'typescript'].forEach(language => {
      const index = readFileSync(
        path.join(path.dirname(file), '..', language, 'index.hbs'),
        'utf8',
      );

      expect(index).toContain(
        "if (isInstalled('@forestadmin/agent-bff')) agent.addGateway({ api: true });",
      );
      expect(index).toContain('function isInstalled(name');
    });
  });

  it('ships portals whose files require only files that ship with them', () => {
    expect.hasAssertions();
    const portals = path.join(path.dirname(file), 'portals');
    const scripts = ['partner-portal', 'lagoon-backoffice'].flatMap(app =>
      ['server.js', 'gateway.js', 'samples.js', 'web.js', 'cases.js']
        .map(name => path.join(portals, app, name))
        .filter(existsSync),
    );

    expect(scripts.length).toBeGreaterThanOrEqual(6);
    scripts.forEach(script => {
      const relative = [...readFileSync(script, 'utf8').matchAll(/require\('(\.{1,2}\/[^']+)'\)/g)];
      relative.forEach(([, required]) =>
        expect(existsSync(`${path.resolve(path.dirname(script), required)}.js`)).toBe(true),
      );
    });
  });

  describe("the portals' gates", () => {
    /** One of the apps' modules, as a demo project gets it. */
    const portalModule = (...parts: string[]) =>
      // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
      require(path.join(path.dirname(file), 'portals', ...parts));
    const gateway = () => portalModule('partner-portal', 'gateway.js');
    const reply = () => {
      const res = { status: 0, writeHead: jest.fn(), end: jest.fn() };
      res.writeHead.mockImplementation((status: number) => {
        res.status = status;
      });

      return res;
    };
    const request = (
      method: string,
      url: string,
      remoteAddress = '127.0.0.1',
      headers: Record<string, string> = { host: 'localhost:3500' },
    ) => ({ method, url, headers, socket: { remoteAddress } });

    it('answers this computer only when run locally, anyone when hosted', () => {
      expect.assertions(4);
      const { localOnly } = gateway();
      const refused = reply();

      expect(localOnly(request('GET', '/', '192.168.1.20'), refused)).toBe(false);
      expect(refused.status).toBe(403);
      expect(localOnly(request('GET', '/', '::1', { host: '[::1]:3500' }), reply())).toBe(true);
      process.env.PUBLIC_URL = 'https://portal.example.com';
      try {
        expect(localOnly(request('GET', '/', '192.168.1.20'), reply())).toBe(true);
      } finally {
        delete process.env.PUBLIC_URL;
      }
    });

    it('refuses a page addressed by another name (DNS rebinding), and writes from another site', () => {
      expect.assertions(6);
      const { localOnly } = gateway();
      const post = (headers: Record<string, string>) =>
        localOnly(request('POST', '/api/apply', '127.0.0.1', headers), reply());

      expect(
        localOnly(request('GET', '/api/home', '127.0.0.1', { host: 'evil.example:3600' }), reply()),
      ).toBe(false);
      expect(post({ host: 'localhost:3500', origin: 'http://evil.example' })).toBe(false);
      expect(post({ host: 'localhost:3500', 'sec-fetch-site': 'cross-site' })).toBe(false);
      expect(post({ host: 'localhost:3500', origin: 'null' })).toBe(false);
      expect(post({ host: '127.0.0.1:3500', origin: 'http://127.0.0.1:3500' })).toBe(true);
      // A command-line client sends no Origin: still from this machine, to localhost.
      expect(post({ host: 'localhost:3500' })).toBe(true);
    });

    it('reads a quoted key followed by spaces without its quotes', () => {
      expect.assertions(1);
      const dotenv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'portal-env-')), '.env');
      fs.writeFileSync(dotenv, 'FOREST_GATEWAY_KEY="fgw_key"   \n');

      expect(gateway().readEnv(dotenv).FOREST_GATEWAY_KEY).toBe('fgw_key');
    });

    it('asks for screening before an approval, and reads the whole queue, page after page', async () => {
      expect.assertions(4);
      const { guide, queue } = portalModule('lagoon-backoffice', 'cases.js');
      const checked = { status: 'OPEN', docs_complete: '✓', idcheck_result: '✓ match' };
      const open = Array.from({ length: 237 }, (_, i) => ({
        id: `k${i}`,
        status: 'OPEN',
        opened_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
        customer_id: `c${i}`,
        partner: 'Lagoon',
      }));
      const fake = {
        mask: (text: string) => text,
        list: async (collection: string, { page }: { page: { limit: number; offset: number } }) => {
          const rows =
            collection === 'kyc_cases'
              ? open
              : open.map(k => ({ id: k.customer_id, partner: 'Lagoon' }));

          return { status: 200, body: { data: rows.slice(page.offset, page.offset + page.limit) } };
        },
      };

      expect(guide({ ...checked, screening_result: '' }).advice.action).toBe('screen');
      expect(guide({ ...checked, screening_result: '✓ no hit' }).advice.action).toBe('approve');
      expect(
        guide({ ...checked, screening_result: '○ SCR-1: A. Name, PEP, score 81, cleared before' })
          .advice.action,
      ).toBe('approve');
      await expect(queue(fake, {}, {})).resolves.toHaveLength(237);
    });

    it('takes no name inherited from Object for an action or an age, as an address could ask', () => {
      expect.assertions(2);
      const { ACTIONS } = portalModule('lagoon-backoffice', 'cases.js');

      expect(ACTIONS.toString).toBeUndefined();
      expect(ACTIONS.approve).toBe('Approve KYC');
    });

    it('keeps the demo password on everything but an uploaded file, read as the router reads it', () => {
      expect.assertions(4);
      const { passwordGate } = gateway();
      process.env.DEMO_PASSWORD = 'sentinel';
      try {
        const upload = `/files/${'a'.repeat(32)}`;
        expect(passwordGate(request('GET', upload), reply())).toBe(true);
        expect(passwordGate(request('GET', '/files/../api/home'), reply())).toBe(false);
        expect(passwordGate(request('POST', `/files/../api/apply`), reply())).toBe(false);
        expect(passwordGate(request('POST', upload), reply())).toBe(false);
      } finally {
        delete process.env.DEMO_PASSWORD;
      }
    });

    it("counts the back office's week from Monday 00:00 in Paris, summer time included", () => {
      expect.assertions(3);
      const { parisMonday } = portalModule('lagoon-backoffice', 'cases.js');

      expect(parisMonday(new Date('2026-11-26T23:30:00Z')).toISOString()).toBe(
        '2026-11-22T23:00:00.000Z',
      );
      expect(parisMonday(new Date('2026-03-30T10:47:13Z')).toISOString()).toBe(
        '2026-03-29T22:00:00.000Z',
      );
      expect(parisMonday(new Date('2026-10-28T08:15:59Z')).toISOString()).toBe(
        '2026-10-25T23:00:00.000Z',
      );
    });
  });

  it('ships a sample PDF for every kind the portal asks for, clean and flawed', () => {
    expect.hasAssertions();
    const samples = path.join(path.dirname(file), 'portals', 'partner-portal', 'samples');

    ['passport', 'carte_identite', 'selfie', 'facture_edf'].forEach(name => {
      expect(existsSync(path.join(samples, `${name}.pdf`))).toBe(true);
      expect(existsSync(path.join(samples, `${name}_flawed.pdf`))).toBe(true);
    });
  });

  it('closes the demo server on shutdown, as the standalone server does', () => {
    expect.hasAssertions();
    ['javascript', 'typescript'].forEach(language => {
      const index = readFileSync(
        path.join(path.dirname(file), '..', language, 'index.hbs'),
        'utf8',
      );

      expect(index).toContain('const server = app.listen(');
      expect(index.indexOf('server.close(')).toBeLessThan(index.indexOf('await agent.stop()'));
    });
  });

  it('ships each workflow with its BPMN file, so layout:apply uploads it', () => {
    expect.hasAssertions();
    const workflows = (read().workflows ?? []) as Array<{
      id: string;
      bpmnAwsS3Identifier?: string;
    }>;
    const folder = path.join(path.dirname(file), 'workflows');

    expect(workflows.length).toBeGreaterThan(0);
    workflows.forEach(workflow => {
      expect(workflow.bpmnAwsS3Identifier).toStrictEqual(expect.any(String));
      expect(existsSync(path.join(folder, `${workflow.id}.bpmn`))).toBe(true);
    });
  });
});
