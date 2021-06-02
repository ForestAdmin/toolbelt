const CommandGenerateConfigGetter = require('../../src/commands/projects/create/command-generate-config-getter');

describe('services > command generate config getter', () => {
  describe('with a command with a "connectionUrl" option', () => {
    it('should require [dbConnectionUrl, dbSchema, ssl, mongodbSrv, appName, appHostname, appPort]', () => {
      expect.assertions(1);
      const options = CommandGenerateConfigGetter
        .getOptions({ connectionUrl: 'postgres://forest:secret@localhost:5435/forest' });
      expect(options).toStrictEqual([
        'dbConnectionUrl',
        'dbSchema',
        'ssl',
        'mongodbSrv',
        'appName',
        'appHostname',
        'appPort',
        'email',
      ]);
    });
  });

  describe('with a command with no options', () => {
    it('should require [dbDialect, dbName, dbHostname, dbPort, dbUser, dbPassword, dbSchema, email, ssl, mongodbSrv, appName, appHostname, appPort]', () => {
      expect.assertions(1);
      const options = CommandGenerateConfigGetter.getOptions({ db: true });
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
        'appName',
        'appHostname',
        'appPort',
        'email',
      ]);
    });
  });
});
