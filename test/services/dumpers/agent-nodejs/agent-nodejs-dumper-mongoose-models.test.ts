import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import fs from 'fs';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJsDumper from '../../../../src/services/dumpers/agent-nodejs';
import Languages from '../../../../src/utils/languages';
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

  async function dump(language, schema) {
    rimraf.sync(`${appRoot}/test-output/mongodb/`);

    const config = {
      name: 'mongodb',
      appConfig: {
        appName: 'test-output/mongodb',
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
    };

    const injectedContext = Context.execute(defaultPlan);
    const dumper = new AgentNodeJsDumper(injectedContext);
    await dumper.dump(
      {
        appConfig: config.appConfig,
        dbConfig: config.dbConfig,
        forestAuthSecret: 'forestAuthSecret',
        forestEnvSecret: 'forestEnvSecret',
        language: Languages.Javascript,
      },
      schema,
    );
  }

  const languages = [{ name: Languages.Javascript, extension: 'js' }];

  describe.each(languages)('language: %s', ({ name: language, extension }) => {
    describe('dump model files', () => {
      describe('dumping schema', () => {
        const testCases = [
          {
            name: 'should handle deep nested fields',
            schema: deepNested,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/deep-nested.expected.${extension}`,
            },
          },
          {
            name: 'should handle has many fields',
            schema: hasMany,
            file: {
              model: 'films',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/hasmany.expected.${extension}`,
            },
          },
          {
            name: 'should handle ambiguous ids in sub documents',
            schema: subDocsAmbiguousIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/sub-documents-ambiguous-ids.expected.${extension}`,
            },
          },
          {
            name: 'should handle sub document not using ids',
            schema: subDocumentsNoIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/sub-documents-no-ids.expected.${extension}`,
            },
          },
          {
            name: 'should handle many objectId fields',
            schema: manyObjectIdFields,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/many-object-id-fields.expected.${extension}`,
            },
          },
          {
            name: 'should handle sub documents using ids',
            schema: subDocumentsWithIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language}/mongo-models/sub-documents-with-ids.expected.${extension}`,
            },
          },
        ];

        it.each(testCases)(`$name`, async ({ schema, file }) => {
          expect.hasAssertions();

          rimraf.sync(`${appRoot}/test-output/mongodb/`);

          await dump(language, schema);

          const expectedFile = fs.readFileSync(file.expectedFilePath, 'utf-8');
          const generatedFile = fs.readFileSync(
            `${appRoot}/test-output/mongodb/models/${file.model}.${extension}`,
            'utf8',
          );

          expect(generatedFile).toStrictEqual(expectedFile);
        });
      });

      describe('dumping export', () => {
        it('should export expected values', async () => {
          expect.assertions(2);

          await dump(language, simple);

          const generatedFile = fs.readFileSync(
            `${appRoot}/test-output/mongodb/models/films.${extension}`,
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

        await dump(language, simple);

        const expectedFile = fs.readFileSync(
          `${__dirname}/expected/${language}/mongo-models/index.expected.${extension}`,
          'utf-8',
        );
        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/mongodb/models/index.${extension}`,
          'utf8',
        );

        expect(generatedFile).toStrictEqual(expectedFile);
      });
    });
  });
});
