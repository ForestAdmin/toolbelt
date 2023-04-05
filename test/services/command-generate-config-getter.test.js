const CommandGenerateConfigGetter = require('../../src/services/projects/create/command-generate-config-getter');
const { default: languages } = require('../../src/utils/languages');

describe('services > command generate config getter', () => {
  describe('with a command with a "connectionUrl" option', () => {
    it('should require [dbConnectionUrl, dbSchema, ssl, applicationName, appHostname, appPort]', () => {
      expect.assertions(1);
      const options = CommandGenerateConfigGetter.getRequestList({
        databaseConnectionURL: 'postgres://forest:secret@localhost:5435/forest',
      });
      expect(options).toStrictEqual([
        'dbConnectionUrl',
        'dbSchema',
        'ssl',
        'applicationName',
        'appHostname',
        'appPort',
      ]);
    });
  });

  describe('with a command with no options', () => {
    it('should require [dbDialect, dbName, dbHostname, dbPort, dbUser, dbPassword, dbSchema, email, ssl, mongodbSrv, applicationName, appHostname, appPort]', () => {
      expect.assertions(1);
      const options = CommandGenerateConfigGetter.getRequestList({ db: true });
      expect(options).toStrictEqual([
        'dbDialect',
        'dbName',
        'dbHostname',
        'dbPort',
        'dbUser',
        'dbPassword',
        'mongodbSrv',
        'dbSchema',
        'ssl',
        'applicationName',
        'appHostname',
        'appPort',
      ]);
    });
  });

  describe('with a command with language flag', () => {
    it('should require [dbDialect, dbName, dbHostname, dbPort, dbUser, dbPassword, dbSchema, email, ssl, mongodbSrv, applicationName, appHostname, appPort, language]', () => {
      expect.assertions(1);
      const options = CommandGenerateConfigGetter.getRequestList({
        db: true,
        language: languages.Javascript.name,
      });
      expect(options).toStrictEqual([
        'dbDialect',
        'dbName',
        'dbHostname',
        'dbPort',
        'dbUser',
        'dbPassword',
        'mongodbSrv',
        'dbSchema',
        'ssl',
        'applicationName',
        'appHostname',
        'appPort',
        'language',
      ]);
    });
  });
});
