const appRoot = require('app-root-path');
const rimraf = require('rimraf');
const Context = require('@forestadmin/context');
const fs = require('fs');
const renderingModel = require('./expected/sequelize/db-analysis-output/renderings.expected.json');
const makeDefaultPlan = require('../../../src/context/init');

const Dumper = require('../../../src/services/dumper/dumper');

const TYPE_CAST = 'databaseOptions.dialectOptions.typeCast';

function cleanOutput() {
  rimraf.sync(`${appRoot}/test-output/mssql`);
  rimraf.sync(`${appRoot}/test-output/mysql`);
  rimraf.sync(`${appRoot}/test-output/postgres`);
}

describe('services > dumper > SQL', () => {
  describe('database MySQL', () => {
    async function dump() {
      const config = {
        appName: 'test-output/mysql',
        dbDialect: 'mysql',
        dbConnectionUrl: 'mysql://localhost:8999',
        ssl: false,
        dbSchema: 'public',
        appHostname: 'localhost',
        appPort: 1654,
        path: appRoot,
      };

      const injectedContext = Context.execute(makeDefaultPlan());
      const dumper = new Dumper(injectedContext);
      await dumper.dump({}, config);
    }

    it('should force type casting for boolean in config/databases.js file', async () => {
      expect.assertions(1);
      await dump();
      const indexGeneratedFile = fs.readFileSync(`${appRoot}/test-output/mysql/config/databases.js`, 'utf-8');

      expect(indexGeneratedFile).toStrictEqual(expect.stringMatching(TYPE_CAST));
      cleanOutput();
    });
  });

  describe('database MSSQL', () => {
    async function dump() {
      const config = {
        appName: 'test-output/mssql',
        dbDialect: 'mssql',
        dbConnectionUrl: 'mssql://localhost:1432',
        ssl: false,
        dbSchema: 'public',
        appHostname: 'localhost',
        appPort: 1654,
        path: appRoot,
      };

      const injectedContext = Context.execute(makeDefaultPlan());
      const dumper = new Dumper(injectedContext);
      await dumper.dump({}, config);
    }

    it('should not force type casting in config/databases.js file', async () => {
      expect.assertions(1);
      await dump();
      const indexGeneratedFile = fs.readFileSync(`${appRoot}/test-output/mssql/config/databases.js`, 'utf-8');

      expect(indexGeneratedFile).toStrictEqual(expect.not.stringMatching(TYPE_CAST));
      cleanOutput();
    });
  });

  describe('database postgreSQL', () => {
    async function dump() {
      const config = {
        appName: 'test-output/postgres',
        dbDialect: 'postgres',
        dbConnectionUrl: 'postgres://localhost:54369',
        ssl: false,
        dbSchema: 'public',
        appHostname: 'localhost',
        appPort: 1654,
        path: appRoot,
      };

      const injectedContext = Context.execute(makeDefaultPlan());
      const dumper = new Dumper(injectedContext);
      await dumper.dump(renderingModel, config);
    }

    it('should generate a model file', async () => {
      expect.assertions(1);
      await dump();
      const renderingsGeneratedFile = fs.readFileSync(`${appRoot}/test-output/postgres/models/renderings.js`, 'utf8');
      const renderingsExpectedFile = fs.readFileSync(`${__dirname}/expected/sequelize/dumper-output/renderings.expected.js`, 'utf-8');
      expect(renderingsGeneratedFile).toStrictEqual(renderingsExpectedFile);
    });

    it('should not force type casting in config/databases.js file', () => {
      expect.assertions(1);
      const indexGeneratedFile = fs.readFileSync(`${appRoot}/test-output/postgres/config/databases.js`, 'utf-8');

      expect(indexGeneratedFile).toStrictEqual(expect.not.stringMatching(TYPE_CAST));
      cleanOutput();
    });
  });
});
