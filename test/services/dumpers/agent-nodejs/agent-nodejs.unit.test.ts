/* eslint-disable jest/max-nested-describe */
import type { Config } from '../../../../src/interfaces/project-create-interface';
import type { Language } from '../../../../src/utils/languages';

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import AgentNodeJs from '../../../../src/services/dumpers/agent-nodejs';
import languages from '../../../../src/utils/languages';

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
