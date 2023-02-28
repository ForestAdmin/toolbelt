const Context = require('@forestadmin/context');
const rimraf = require('rimraf');
const fs = require('fs');
const appRoot = require('app-root-path');

const simpleModel = require('../../analyzer/expected/mongo/db-analysis-output/simple.expected.json');
const hasManyModel = require('../../analyzer/expected/mongo/db-analysis-output/hasmany.expected.json');
const nestedObjectModel = require('../../analyzer/expected/mongo/db-analysis-output/nested-object-fields.expected.json');
const nestedArrayOfNumbersModel = require('../../analyzer/expected/mongo/db-analysis-output/nested-array-of-numbers-fields.expected.json');
const nestedArrayOfObjectsModel = require('../../analyzer/expected/mongo/db-analysis-output/nested-array-of-objects-fields.expected.json');
const deepNestedModel = require('../../analyzer/expected/mongo/db-analysis-output/deep-nested-fields.expected.json');
const subDocumentNotUsingIds = require('../../analyzer/expected/mongo/db-analysis-output/sub-document-not-using-ids.expected.json');
const subDocumentsAmbiguousIds = require('../../analyzer/expected/mongo/db-analysis-output/sub-documents-ambiguous-ids.expected.json');
const subDocumentsNotUsingIds = require('../../analyzer/expected/mongo/db-analysis-output/sub-documents-not-using-ids.expected.json');
const subDocumentsUsingIds = require('../../analyzer/expected/mongo/db-analysis-output/sub-documents-using-ids.expected.json');
const subDocumentUsingIds = require('../../analyzer/expected/mongo/db-analysis-output/sub-document-using-ids.expected.json');
const Dumper = require('../../../../src/services/dumpers/dumper-v1');
const defaultPlan = require('../../../../src/context/plan');

function buildContext() {
  return Context.execute(defaultPlan);
}

function getDumper(context) {
  return new Dumper(context);
}

const CONFIG = {
  appConfig: {
    applicationName: 'test-output/mongo',
    appHostname: 'localhost',
    appPort: 1654,
    path: appRoot,
  },
  dbConfig: {
    dbConnectionUrl: 'mongodb://localhost:27017',
    dbDialect: 'mongodb',
    ssl: false,
    dbSchema: 'public',
  },
};

function cleanOutput() {
  rimraf.sync(`${appRoot}/test-output/mongo`);
}

async function getGeneratedFileFromPersonModel(model, context) {
  const dumper = getDumper(context);
  await dumper.dump(CONFIG, model);
  return fs.readFileSync(`${appRoot}/test-output/mongo/models/persons.js`, 'utf8');
}

const TEST_OUTPUT_MODEL_FILMS_PATH = `${appRoot}/test-output/mongo/models/films.js`;
const TEST_EXPECTED_MODEL_FILMS_PATH = `${__dirname}/expected/mongo/simple.expected.js`;

describe('services > dumper > MongoDB', () => {
  it('should generate a simple model file', async () => {
    expect.assertions(1);
    const context = buildContext();
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, simpleModel);
    const generatedFile = fs.readFileSync(TEST_OUTPUT_MODEL_FILMS_PATH, 'utf8');
    const expectedFile = fs.readFileSync(TEST_EXPECTED_MODEL_FILMS_PATH, 'utf8');

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with hasMany', async () => {
    expect.assertions(1);
    const context = buildContext();
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, hasManyModel);
    const generatedFile = fs.readFileSync(TEST_OUTPUT_MODEL_FILMS_PATH, 'utf8');
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/hasmany.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  describe('handling /models/index.js file', () => {
    it('should not force type casting', async () => {
      expect.assertions(1);
      const context = buildContext();
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      const indexGeneratedFile = fs.readFileSync(
        `${appRoot}/test-output/mongo/models/index.js`,
        'utf-8',
      );

      expect(indexGeneratedFile).toStrictEqual(
        expect.not.stringMatching('databaseOptions.dialectOptions.typeCast'),
      );
      cleanOutput();
    });

    it('should generate a model/index.js file', async () => {
      expect.assertions(1);
      const context = buildContext();
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      const indexGeneratedFile = fs.readFileSync(
        `${appRoot}/test-output/mongo/models/index.js`,
        'utf-8',
      );
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/mongo/index.expected.js`,
        'utf-8',
      );

      expect(indexGeneratedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });

    it('should generate a config/databases.js file', async () => {
      expect.assertions(1);
      const context = buildContext();
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      const indexGeneratedFile = fs.readFileSync(
        `${appRoot}/test-output/mongo/config/databases.js`,
        'utf-8',
      );
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/mongo/databases.config.expected.js`,
        'utf-8',
      );

      expect(indexGeneratedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });
  });

  it('generate a model file with a nested object', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(nestedObjectModel, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/nested-object.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with a nested array of numbers', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(nestedArrayOfNumbersModel, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/nested-array-of-numbers.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with a nested array of objects', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(nestedArrayOfObjectsModel, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/nested-array-of-objects.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with a deep nested objects/array', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(deepNestedModel, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/deep-nested.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with subDocuments using _ids', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(subDocumentsUsingIds, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/sub-documents-using-ids.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with subDocuments not using _ids', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(subDocumentsNotUsingIds, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/sub-documents-not-using-ids.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with subDocuments with ambiguous _ids', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(subDocumentsAmbiguousIds, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/sub-documents-ambiguous-ids.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with subDocument using _ids', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(subDocumentUsingIds, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/sub-document-using-ids.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('generate a model file with subDocument not using _ids', async () => {
    expect.assertions(1);
    const context = buildContext();
    const generatedFile = await getGeneratedFileFromPersonModel(subDocumentNotUsingIds, context);
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/mongo/sub-document-not-using-ids.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  describe('on re-dump', () => {
    it('should recreate files that have been deleted', async () => {
      expect.assertions(1);

      const context = buildContext();
      // Setup test by dumping once to ensure all files exists, then remove a file
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      fs.unlinkSync(TEST_OUTPUT_MODEL_FILMS_PATH);

      await dumper.dump({ ...CONFIG, isUpdate: true }, simpleModel);
      const generatedFile = fs.readFileSync(TEST_OUTPUT_MODEL_FILMS_PATH, 'utf8');
      const expectedFile = fs.readFileSync(TEST_EXPECTED_MODEL_FILMS_PATH, 'utf8');

      // Then we ensure that the file that were removed exists after a redump
      expect(generatedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });
  });

  describe('/forest folder', () => {
    it('should add `fieldsToFlatten` property in the generated file', async () => {
      expect.assertions(1);

      const context = buildContext();
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      const generatedFile = fs.readFileSync(`${appRoot}/test-output/mongo/forest/films.js`, 'utf8');
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/mongo/forest-simple.expected.js`,
        'utf8',
      );

      expect(generatedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });
  });
});
