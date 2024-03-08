import Context from '@forestadmin/context';
import appRoot from 'app-root-path';
import fs from 'fs';
import rimraf from 'rimraf';

import defaultPlan from '../../../../src/context/plan';
import AgentNodeJsDumper from '../../../../src/services/dumpers/agent-nodejs';
import languages from '../../../../src/utils/languages';
import collectionsWithSpecialCharacters from '../../analyzer/expected/mongo/db-analysis-output/collections-with-special-characters.expected.json';
import deepNestedColumn from '../../analyzer/expected/mongo/db-analysis-output/deep-nested-fields-column.expected.json';
import deepNested from '../../analyzer/expected/mongo/db-analysis-output/deep-nested-fields.expected.json';
import hasMany from '../../analyzer/expected/mongo/db-analysis-output/hasmany.expected.json';
import manyObjectIdFields from '../../analyzer/expected/mongo/db-analysis-output/many-objectid-fields.expected.json';
import simple from '../../analyzer/expected/mongo/db-analysis-output/simple.expected.json';
import subDocsAmbiguousIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-ambiguous-ids.expected.json';
import subDocumentsNoIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-not-using-ids.expected.json';
import subDocumentsWithIds from '../../analyzer/expected/mongo/db-analysis-output/sub-documents-using-ids.expected.json';

describe('services > dumpers > agentNodejsDumper > mongoose models', () => {
  async function dump(language, schema) {
    rimraf.sync(`${appRoot}/test-output/${language.name}/mongodb/`);

    const config = {
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
    };

    const injectedContext = Context.execute(defaultPlan) as any;

    const loggerWarnSpy = jest.spyOn(injectedContext.logger, 'warn');

    const dumper = new AgentNodeJsDumper(injectedContext);
    await dumper.dump(config, schema);

    return {
      loggerWarnSpy,
    };
  }

  describe.each([languages.Javascript, languages.Typescript])('language: $name', language => {
    // eslint-disable-next-line jest/no-hooks
    afterAll(() => {
      rimraf.sync(`${appRoot}/test-output/${language.name}/mongodb/`);
    });

    describe('dump model files', () => {
      describe('dumping schema', () => {
        const testCases = [
          {
            name: 'should handle deep nested fields',
            schema: deepNested,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/deep-nested.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should handle has many fields',
            schema: hasMany,
            file: {
              model: 'films',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/hasmany.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should handle ambiguous ids in sub documents',
            schema: subDocsAmbiguousIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/sub-documents-ambiguous-ids.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should handle sub document not using ids',
            schema: subDocumentsNoIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/sub-documents-no-ids.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should handle many objectId fields',
            schema: manyObjectIdFields,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/many-object-id-fields.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should handle sub documents using ids',
            schema: subDocumentsWithIds,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/sub-documents-with-ids.expected.${language.fileExtension}`,
            },
          },
          {
            name: 'should not dump any fields containing column',
            schema: deepNestedColumn,
            file: {
              model: 'persons',
              expectedFilePath: `${__dirname}/expected/${language.name}/mongo-models/deep-nested-column.expected.${language.fileExtension}`,
            },
          },
        ];

        it.each(testCases)(`$name`, async ({ schema, file }) => {
          expect.hasAssertions();

          rimraf.sync(`${appRoot}/test-output/${language.name}/mongodb/`);

          await dump(language, schema);

          const expectedFile = fs.readFileSync(file.expectedFilePath, 'utf-8');
          const generatedFile = fs.readFileSync(
            `${appRoot}/test-output/${language.name}/mongodb/models/${file.model}.${language.fileExtension}`,
            'utf8',
          );

          expect(generatedFile).toStrictEqual(expectedFile);
        });

        it('should warn information when a field containing column has been ignored', async () => {
          expect.assertions(4);

          rimraf.sync(`${appRoot}/test-output/${language.name}/mongodb/`);

          const { loggerWarnSpy } = await dump(language, deepNestedColumn);

          expect(loggerWarnSpy).toHaveBeenCalledTimes(3);
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            'Ignoring field name:column from collection persons as it contains column and is not valid.',
          );
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            'Ignoring field answer:column from collection persons as it contains column and is not valid.',
          );
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            'Ignoring field so:column from collection persons as it contains column and is not valid.',
          );
        });

        it('should correctly dump interfaces and classes when collection has special characters', async () => {
          expect.assertions(3);

          rimraf.sync(`${appRoot}/test-output/${language.name}/mongodb/`);

          await dump(language, collectionsWithSpecialCharacters);

          const expectedIndex = fs.readFileSync(
            `${__dirname}/expected/${language.name}/mongo-models/collection-special-characters/index.${language.fileExtension}`,
            'utf-8',
          );
          const generatedIndex = fs.readFileSync(
            `${appRoot}/test-output/${language.name}/mongodb/models/index.${language.fileExtension}`,
            'utf8',
          );
          const expectedOtherSpecialCharacter = fs.readFileSync(
            `${__dirname}/expected/${language.name}/mongo-models/collection-special-characters/other-special-character.expected.${language.fileExtension}`,
            'utf-8',
          );
          const generatedOtherSpecialCharacter = fs.readFileSync(
            `${appRoot}/test-output/${language.name}/mongodb/models/other-special-character.${language.fileExtension}`,
            'utf8',
          );
          const expectedSpecialCharacter = fs.readFileSync(
            `${__dirname}/expected/${language.name}/mongo-models/collection-special-characters/special-character.expected.${language.fileExtension}`,
            'utf-8',
          );
          const generatedSpecialCharacter = fs.readFileSync(
            `${appRoot}/test-output/${language.name}/mongodb/models/special-character.${language.fileExtension}`,
            'utf8',
          );

          expect(generatedIndex).toStrictEqual(expectedIndex);
          expect(generatedSpecialCharacter).toStrictEqual(expectedSpecialCharacter);
          expect(generatedOtherSpecialCharacter).toStrictEqual(expectedOtherSpecialCharacter);
        });
      });
    });

    describe(`dump index.${language.fileExtension}`, () => {
      it(`should dump an index.${language.fileExtension} file`, async () => {
        expect.assertions(1);

        await dump(language, simple);

        const expectedFile = fs.readFileSync(
          `${__dirname}/expected/${language.name}/mongo-models/index.expected.${language.fileExtension}`,
          'utf-8',
        );
        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/${language.name}/mongodb/models/index.${language.fileExtension}`,
          'utf8',
        );

        expect(generatedFile).toStrictEqual(expectedFile);
      });
    });
  });

  describe('dumping export', () => {
    describe('javascript', () => {
      it('should export expected values', async () => {
        expect.assertions(2);

        const language = languages.Javascript;

        await dump(language, simple);

        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/${language.name}/mongodb/models/films.${language.fileExtension}`,
          'utf8',
        );

        expect(generatedFile).toContain(`collectionName: 'films'`);
        expect(generatedFile).toContain(`modelName: 'films'`);
      });
    });

    describe('typescript', () => {
      it('should export expected values', async () => {
        expect.assertions(1);

        const language = languages.Typescript;

        await dump(language, simple);

        const generatedFile = fs.readFileSync(
          `${appRoot}/test-output/${language.name}/mongodb/models/films.${language.fileExtension}`,
          'utf8',
        );

        expect(generatedFile).toContain(`export { FilmsInterface, filmsSchema }`);
      });
    });
  });
});
