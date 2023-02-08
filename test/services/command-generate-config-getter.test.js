const GeneralPrompter = require('../../src/services/prompter/general-prompter');
const CommandGenerateConfigGetter = require('../../src/services/projects/create/command-generate-config-getter');

describe('services > command generate config getter', () => {
  describe('with a command with a "connectionUrl" option', () => {
    it('should require [dbConnectionUrl, dbSchema, ssl, mongodbSrv, applicationName, appHostname, appPort]', () => {
      expect.assertions(1);
      const commandGenerateConfigGetter = new CommandGenerateConfigGetter({
        assertPresent: () => true,
        GeneralPrompter,
      });
      const options = commandGenerateConfigGetter.getRequestList({
        databaseConnectionURL: 'postgres://forest:secret@localhost:5435/forest',
      });
      expect(options).toStrictEqual([
        'dbConnectionUrl',
        'dbSchema',
        'ssl',
        'mongodbSrv',
        'applicationName',
        'appHostname',
        'appPort',
      ]);
    });
  });

  describe('with a command with no options', () => {
    it('should require [dbDialect, dbName, dbHostname, dbPort, dbUser, dbPassword, dbSchema, email, ssl, mongodbSrv, applicationName, appHostname, appPort]', () => {
      expect.assertions(1);
      const commandGenerateConfigGetter = new CommandGenerateConfigGetter({
        assertPresent: () => true,
        GeneralPrompter,
      });
      const options = commandGenerateConfigGetter.getRequestList({ db: true });
      expect(options).toStrictEqual([
        'dbDialect',
        'dbName',
        'dbHostname',
        'dbPort',
        'dbUser',
        'dbPassword',
        'dbSchema',
        'ssl',
        'mongodbSrv',
        'applicationName',
        'appHostname',
        'appPort',
      ]);
    });
  });
});
