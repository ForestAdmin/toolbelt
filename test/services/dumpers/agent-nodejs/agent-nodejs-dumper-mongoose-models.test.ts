import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import fs from 'fs';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJsDumper from '../../../../src/services/dumpers/agent-nodejs';
import deepNested from '../../analyzer/expected/mongo/db-analysis-output/deep-nested-fields.expected.json';
import hasMany from '../../analyzer/expected/mongo/db-analysis-output/hasmany.expected.json';
import manyObjectIdFields from '../../analyzer/expected/mongo/db-analysis-output/many-objectid-fields.expected.json';
import simple from '../../analyzer/expected/mongo/db-analysis-output/simple.expected.json';
import subDocsAmbiguousIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-ambiguous-ids.expected.json';
import subDocumentsNoIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-not-using-ids.expected.json';
import subDocumentsWithIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-using-ids.expected.json';

describe('services > dumpers > agentNodejsDumper > mongoose models', () => {
  // eslint-disable-next-line jest/no-hooks
  afterAll(() => {
    rimraf.sync(`${appRoot}/test-output/mongodb/`);
  });

  async function dump(schema) {
    rimraf.sync(`${appRoot}/test-output/mongodb/`);

    const config = {
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
    };

    const injectedContext = Context.execute(defaultPlan);
    const dumper = new AgentNodeJsDumper(injectedContext);
    await dumper.dump(
      {
        appConfig: config.appConfig,
        dbConfig: config.dbConfig,
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
      },
      schema,
    );
  }

  describe('dump model files', () => {
    describe('dumping schema', () => {
      const testCases = [
        {
          name: 'should handle deep nested fields',
          schema: deepNested,
          file: {
            model: 'persons',
            expectedFilePath: `${__dirname}/expected/mongo-models/deep-nested.expected.js`,
          },
        },
        {
          name: 'should handle has many fields',
          schema: hasMany,
          file: {
            model: 'films',
            expectedFilePath: `${__dirname}/expected/mongo-models/hasmany.expected.js`,
          },
        },
        {
          name: 'should handle ambiguous ids in sub documents',
          schema: subDocsAmbiguousIds,
          file: {
            model: 'persons',
            expectedFilePath: `${__dirname}/expected/mongo-models/sub-documents-ambiguous-ids.expected.js`,
          },
        },
        {
          name: 'should handle sub document not using ids',
          schema: subDocumentsNoIds,
          file: {
            model: 'persons',
            expectedFilePath: `${__dirname}/expected/mongo-models/sub-documents-no-ids.expected.js`,
          },
        },
        {
          name: 'should handle many objectId fields',
          schema: manyObjectIdFields,
          file: {
            model: 'persons',
            expectedFilePath: `${__dirname}/expected/mongo-models/many-object-id-fields.expected.js`,
          },
        },
        {
          name: 'should handle sub documents using ids',
          schema: subDocumentsWithIds,
          file: {
            model: 'persons',
            expectedFilePath: `${__dirname}/expected/mongo-models/sub-documents-with-ids.expected.js`,
          },
        },
      ];

      it.each(testCases)(`yeah $name`, async ({ schema, file }) => {
        expect.hasAssertions();

        rimraf.sync(`${appRoot}/test-output/mongodb/`);

        await dump(schema);

        const expectedFile = fs.readFileSync(file.expectedFilePath, 'utf-8');
        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/mongodb/models/primary/${file.model}.js`,
          'utf8',
        );

        expect(generatedFile).toStrictEqual(expectedFile);
      });
    });

    describe('dumping export', () => {
      it('should export expected values', async () => {
        expect.assertions(2);

        await dump(simple);

        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/mongodb/models/primary/films.js`,
          'utf8',
        );

        expect(generatedFile).toContain(`collectionName: 'films'`);
        expect(generatedFile).toContain(`modelName: 'films'`);
      });
    });
  });

  describe('dump index.js', () => {
    it('should dump an index.js file', async () => {
      expect.assertions(1);

      await dump(simple);

      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/mongo-models/index.expected.js`,
        'utf-8',
      );
      const generatedFile = fs.readFileSync(
        `${appRoot}/test-output/mongodb/models/primary/index.js`,
        'utf8',
      );

      expect(generatedFile).toStrictEqual(expectedFile);
    });
  });
});