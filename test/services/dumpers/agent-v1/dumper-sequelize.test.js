const { execute } = require('@forestadmin/context');
const rimraf = require('rimraf');
const fs = require('fs');
const appRoot = require('app-root-path');
const simpleModel = require('../../analyzer/expected/sequelize/db-analysis-output/customers.expected.json');
const belongsToModel = require('../../analyzer/expected/sequelize/db-analysis-output/addresses.expected.json');
const simpleModelNonPrimary = require('../../analyzer/expected/sequelize/db-analysis-output/owners.expected.json');
const belongsToModelNonPrimary = require('../../analyzer/expected/sequelize/db-analysis-output/projects.expected.json');
const otherAssociationsModel = require('../../analyzer/expected/sequelize/db-analysis-output/users.expected.json');
const joinTableWithIdKey = require('../../analyzer/expected/sequelize/db-analysis-output/only-foreign-keys-and-id.expected.json');
const exportModel = require('../../analyzer/expected/sequelize/db-analysis-output/export.expected.json');
const defaultValuesModel = require('../../analyzer/expected/sequelize/db-analysis-output/default_values.postgres.expected');
const parenthesisColumnName = require('../../analyzer/expected/sequelize/db-analysis-output/parenthesis.expected.json');
const parenthesisColumnNameUnderscored = require('../../analyzer/expected/sequelize/db-analysis-output/parenthesis_underscored.expected.json');
const parenthesisColumnNameUnderscoredTrue = require('../../analyzer/expected/sequelize/db-analysis-output/parenthesis_underscored_true.expected.json');
const defaultPlan = require('../../../../src/context/plan');

const Dumper = require('../../../../src/services/dumpers/forest-express');

function getDumper(context) {
  return new Dumper(context);
}

const CONFIG = {
  appConfig: {
    applicationName: 'test-output/sequelize',
    appHostname: 'localhost',
    appPort: 1654,
    path: appRoot,
  },
  dbConfig: {
    dbDialect: 'postgres',
    dbConnectionUrl: 'postgres://localhost:27017',
    ssl: false,
    dbSchema: 'public',
    db: true,
  },
};

function cleanOutput() {
  rimraf.sync(`${appRoot}/test-output/sequelize`);
}

const TEST_OUTPUT_MODEL_CUSTOMERS_PATH = `${appRoot}/test-output/sequelize/models/customers.js`;

describe('services > dumper > sequelize', () => {
  it('should generate a simple model file', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, simpleModel);
    const generatedFile = fs.readFileSync(TEST_OUTPUT_MODEL_CUSTOMERS_PATH, 'utf8');
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/customers.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with belongsTo associations', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, belongsToModel);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/addresses.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/addresses.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with belongsTo associations and sourceKey/targetKey', async () => {
    expect.assertions(2);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, { ...simpleModelNonPrimary, ...belongsToModelNonPrimary });

    const ownersGeneratedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/owners.js`,
      'utf8',
    );
    const ownersExpectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/owners.expected.js`,
      'utf-8',
    );
    const projectsGeneratedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/projects.js`,
      'utf8',
    );
    const projectsExpectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/projects.expected.js`,
      'utf-8',
    );

    expect(ownersGeneratedFile).toStrictEqual(ownersExpectedFile);
    expect(projectsGeneratedFile).toStrictEqual(projectsExpectedFile);
    cleanOutput();
  });

  it('should generate a model file with correct parenthesis field', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, parenthesisColumnName);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/parenthesis.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/parenthesis.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with correct parenthesis field and correct underscored fields', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, parenthesisColumnNameUnderscored);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/parenthesis-underscored.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/parenthesis_underscored.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with correct parenthesis field and underscored true', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, parenthesisColumnNameUnderscoredTrue);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/parenthesis-underscored-true.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/parenthesis_underscored_true.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a model file with hasMany, hasOne and belongsToMany', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, otherAssociationsModel);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/users.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/users.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should still generate a model file when reserved word is used', async () => {
    expect.assertions(2);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, exportModel);
    const generatedModelFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/export.js`,
      'utf8',
    );
    const generatedRouteFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/routes/export.js`,
      'utf8',
    );
    const expectedModelFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/export.expected.js`,
      'utf-8',
    );
    const expectedRouteFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/export.expected.route.js`,
      'utf-8',
    );

    expect(generatedModelFile).toStrictEqual(expectedModelFile);
    expect(generatedRouteFile).toStrictEqual(expectedRouteFile);
    cleanOutput();
  });

  it('should generate a model with default values', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, defaultValuesModel);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/default-values.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/default-values.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate the model index file', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = getDumper(context);
    await dumper.dump(CONFIG, simpleModel);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/index.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/index.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  it('should generate a config/databases.js file', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = await getDumper(context);
    await dumper.dump(CONFIG, simpleModel);
    const indexGeneratedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/config/databases.js`,
      'utf-8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/databases.config.expected.js`,
      'utf-8',
    );

    expect(indexGeneratedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  describe('when generating the env file on various OS', () => {
    it('should generate the env file on Linux', async () => {
      expect.assertions(1);

      const context = execute(defaultPlan);
      const dumper = getDumper({ ...context, isLinuxOs: true });
      await dumper.dump(CONFIG, simpleModel);

      const generatedFile = fs.readFileSync(`${appRoot}/test-output/sequelize/.env`, 'utf8');
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/sequelize/env.linux.expected`,
        'utf-8',
      );

      expect(generatedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });

    it('should generate the env file on macOS', async () => {
      expect.assertions(1);

      const context = execute(defaultPlan);
      const dumper = getDumper({ ...context, isLinuxOs: false });
      await dumper.dump(CONFIG, simpleModel);

      const generatedFile = fs.readFileSync(`${appRoot}/test-output/sequelize/.env`, 'utf8');
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/sequelize/env.darwin.expected`,
        'utf-8',
      );

      expect(generatedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });
  });

  it('should generate an id column on join tables with id primary key', async () => {
    expect.assertions(1);
    const context = execute(defaultPlan);
    const dumper = await getDumper(context);
    await dumper.dump(CONFIG, joinTableWithIdKey);
    const generatedFile = fs.readFileSync(
      `${appRoot}/test-output/sequelize/models/only-foreign-keys-and-id.js`,
      'utf8',
    );
    const expectedFile = fs.readFileSync(
      `${__dirname}/expected/sequelize/only-foreign-keys-and-id.expected.js`,
      'utf-8',
    );

    expect(generatedFile).toStrictEqual(expectedFile);
    cleanOutput();
  });

  describe('on re-dump', () => {
    it('should recreate files that have been deleted', async () => {
      expect.assertions(1);

      // Setup test by dumping once to ensure all files exists, then remove a file
      const context = execute(defaultPlan);
      const dumper = getDumper(context);
      await dumper.dump(CONFIG, simpleModel);
      fs.unlinkSync(TEST_OUTPUT_MODEL_CUSTOMERS_PATH);

      await dumper.dump({ ...CONFIG, isUpdate: true }, simpleModel);
      const generatedFile = fs.readFileSync(TEST_OUTPUT_MODEL_CUSTOMERS_PATH, 'utf8');
      const expectedFile = fs.readFileSync(
        `${__dirname}/expected/sequelize/customers.expected.js`,
        'utf-8',
      );

      // Then we ensure that the file that were removed exists after a redump
      expect(generatedFile).toStrictEqual(expectedFile);
      cleanOutput();
    });
  });
});
