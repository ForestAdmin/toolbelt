/* eslint-disable jest/max-nested-describe */
import type { Config } from '../../../../src/interfaces/project-create-interface';
import type { Language } from '../../../../src/utils/languages';

import { readFileSync } from 'fs';
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

      it('uses the demo-fintech datasource dependency, not sql', async () => {
        expect.assertions(2);
        const { dumper, context, defaultConfig } = createDumper(language);

        await dumper.dump(demoConfig(defaultConfig));

        const pkgCall = context.fs.writeFileSync.mock.calls.find(([p]: [string]) =>
          p.endsWith('package.json'),
        );
        expect(pkgCall[1]).toContain('@forestadmin/datasource-demo-fintech');
        expect(pkgCall[1]).not.toContain('@forestadmin/datasource-sql');
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
  // Guards on the bundled (hand-trimmed) layout: it must stay valid JSON and
  // consistent with the @forestadmin/datasource-demo-fintech schema (the version
  // pinned in src/services/dumpers/agent-nodejs.ts). Full schema validation
  // belongs to a real `forest layout pull` regeneration.
  const file = path.join(
    __dirname,
    '../../../../src/services/dumpers/templates/agent-nodejs/common/forest-layout.json',
  );

  const FINTECH_COLLECTIONS = [
    'aml_alerts',
    'cards',
    'chargebacks',
    'customers',
    'kyc_cases',
    'kyc_documents',
    'refund_requests',
    'sar_reports',
  ];

  // Relation names registered by @forestadmin/datasource-demo-fintech@1.0.1
  // (dist/customizations/*.js — addManyToOneRelation / addOneToManyRelation calls).
  const FINTECH_RELATIONS: Record<string, string[]> = {
    aml_alerts: ['customer', 'sarReports'],
    cards: ['customer', 'chargebacks'],
    chargebacks: ['customer', 'card', 'refundRequest'],
    customers: [
      'cards',
      'amlAlerts',
      'kycCases',
      'kycDocuments',
      'chargebacks',
      'refundRequests',
      'sarReports',
    ],
    kyc_cases: ['customer', 'documents'],
    kyc_documents: ['customer', 'kycCase'],
    refund_requests: ['customer', 'chargebacks'],
    sar_reports: ['customer', 'alert'],
  };

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

  it('is valid JSON declaring the 8 fintech collections', () => {
    expect.assertions(9);
    const layout = JSON.parse(readFileSync(file, 'utf8'));
    const collectionIds = (layout.layout?.collections ?? []).map(
      (collection: { id: string }) => collection.id,
    );

    expect(collectionIds.length).toBeGreaterThan(0);
    FINTECH_COLLECTIONS.forEach(id => expect(collectionIds).toContain(id));
  });

  it('contains no leftover of the removed BaaSDemo collections', () => {
    expect.assertions(3);
    const raw = readFileSync(file, 'utf8');

    // Collections that existed in the original BaaSDemo export but are not part
    // of the fintech datasource; none of their names may survive anywhere.
    expect(raw).not.toContain('mambu_');
    expect(raw).not.toContain('pg_stat_');
    expect(raw).not.toContain('internal_notes');
  });

  it('contains no BaaSDemo provenance metadata', () => {
    expect.assertions(5);
    const raw = readFileSync(file, 'utf8');
    const layout = JSON.parse(raw);

    // The `forest` header is required by `layout apply` but is provenance-only:
    // it must carry neutral placeholders, not the internal project it was pulled from.
    expect(raw).not.toContain('BaaSDemo');
    expect(raw).not.toContain('Alasta');
    expect(layout.forest.project.id).toBe(0);
    expect(layout.forest.environment.id).toBe(0);
    expect(layout.forest.team.id).toBe(0);
  });

  it('only references the 8 fintech collections in folders', () => {
    const layout = JSON.parse(readFileSync(file, 'utf8'));
    const referenced = (layout.folders ?? []).flatMap(
      (folder: { children: Array<{ id: string; type: string }> }) =>
        folder.children
          .filter(child => child.type === 'collection')
          .map(child => child.id),
    );

    expect(referenced.length).toBeGreaterThan(0);
    referenced.forEach((id: string) => expect(FINTECH_COLLECTIONS).toContain(id));
  });

  it('only uses relation names that exist in the fintech datasource', () => {
    const layout = JSON.parse(readFileSync(file, 'utf8'));

    // Summary views: `has-many` blocks reference a relation of their collection.
    (layout.layout?.collections ?? []).forEach(
      (collection: { id: string; layout: { viewEdit?: { summaryView?: unknown } } }) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const node of walkObjects(collection.layout?.viewEdit?.summaryView)) {
          if (String(node.type).endsWith('/has-many')) {
            const name = (node.data as { name: string }).name;

            expect(FINTECH_RELATIONS[collection.id]).toContain(name);
          }
        }
      },
    );

    // Workspace components: a filter condition with a subFieldName traverses a
    // relation of the component's collection (drives master-detail bindings).
    (layout.layout?.workspaces ?? []).forEach((workspace: { components?: unknown[] }) => {
      (workspace.components ?? []).forEach((component: unknown) => {
        const options = (component as { options?: Record<string, unknown> }).options ?? {};
        const collectionId = options.collectionId as string | undefined;
        const conditions =
          ((options.filter as { conditions?: unknown[] })?.conditions as Array<{
            fieldName: string;
            subFieldName: string | null;
          }>) ?? [];

        conditions
          .filter(condition => condition.subFieldName && collectionId)
          .forEach(condition =>
            expect(FINTECH_RELATIONS[collectionId as string]).toContain(condition.fieldName),
          );
      });
    });
  });

  it('numbers smart action endpoints by the datasource addAction order', () => {
    const layout = JSON.parse(readFileSync(file, 'utf8'));

    // addAction calls in @forestadmin/datasource-demo-fintech@1.0.1
    // (dist/customizations/*.js), in declaration order: the agent exposes each
    // action under /forest/_actions/<collection>/<addAction index>/<slug>.
    const expectedEndpointIndexes: Record<string, Record<string, number>> = {
      aml_alerts: {
        'Clear Alert (False Positive)': 0,
        'Create SAR': 1,
        'Escalate to Compliance': 2,
        'File SAR': 3,
        'Request Enhanced Due Diligence': 4,
      },
      cards: { 'Block Card': 0, 'Unblock Card': 1, 'Replace Card': 2 },
      chargebacks: {
        'File with Network': 0,
        'Request Cardholder Info': 1,
        'Block Linked Card': 2,
        'Accept Liability & Refund Customer': 3,
        'Mark Won': 4,
        'Mark Lost': 5,
        'Dismiss Dispute': 6,
      },
      kyc_cases: { 'Approve KYC': 0, 'Reject KYC': 1, 'Escalate KYC': 2 },
      kyc_documents: { 'Verify Document': 0 },
      refund_requests: { 'Decline Refund': 0, 'Open Chargeback': 1 },
      sar_reports: { 'File SAR': 0 },
    };

    (layout.layout?.collections ?? []).forEach(
      (collection: {
        id: string;
        layout: { actions?: Array<{ endpoint: string; name: string }> };
      }) => {
        const expected = expectedEndpointIndexes[collection.id] ?? {};
        const actions = collection.layout.actions ?? [];

        expect(actions.map(action => action.name).sort()).toStrictEqual(
          Object.keys(expected).sort(),
        );
        actions.forEach(action =>
          expect(action.endpoint).toMatch(
            new RegExp(`^/forest/_actions/${collection.id}/${expected[action.name]}/`),
          ),
        );
      },
    );
  });

  it('keeps the non-executable workflows hidden', () => {
    const layout = JSON.parse(readFileSync(file, 'utf8'));
    const workflows = (layout.workflows ?? []) as Array<{ isVisible: boolean; steps?: unknown }>;

    expect(workflows.length).toBeGreaterThan(0);
    // The bundled workflows only carry a BaaSDemo S3 BPMN identifier (dead
    // cross-project reference) and no `steps` graph: they must stay hidden
    // until they are recompiled with executable steps.
    workflows.forEach(workflow => {
      expect(workflow.isVisible).toBe(false);
      expect(workflow.steps).toBeUndefined();
    });
  });
});
