const REQUESTS_DATABASE_MANDATORY = [
  'dbDialect',
  'dbName',
  'dbHostname',
  'dbPort',
  'dbUser',
  'dbPassword',
  'mongodbSrv',
];
const REQUESTS_DATABASE_OPTIONAL = ['dbSchema', 'ssl'];
const REQUESTS_APPLICATION = ['applicationName', 'appHostname', 'appPort'];

const REQUESTS = {
  forConnectionUrl: ['dbConnectionUrl', ...REQUESTS_DATABASE_OPTIONAL, ...REQUESTS_APPLICATION],
  forFullPrompt: [
    ...REQUESTS_DATABASE_MANDATORY,
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
  ],
};
class CommandGenerateConfigGetter {
  constructor({ assertPresent, GeneralPrompter }) {
    assertPresent({
      GeneralPrompter,
    });
    this.GeneralPrompter = GeneralPrompter;
    this.AVAILABLE_REQUESTS = REQUESTS;
  }

  getRequestList(programArguments) {
    if (programArguments.databaseConnectionURL) {
      return this.AVAILABLE_REQUESTS.forConnectionUrl;
    }
    return this.AVAILABLE_REQUESTS.forFullPrompt;
  }

  async get(programArguments, forSql, forNosql) {
    const requests = this.getRequestList(programArguments);
    return new this.GeneralPrompter(requests, programArguments).getConfig(forSql, forNosql);
  }
}

module.exports = CommandGenerateConfigGetter;
