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
  }

  static getRequestList(programArguments) {
    let requestList;
    if (programArguments.databaseConnectionURL) {
      requestList = REQUESTS.forConnectionUrl;
    } else {
      requestList = REQUESTS.forFullPrompt;
    }

    return typeof programArguments.language === 'string'
      ? [...requestList, 'language']
      : requestList;
  }

  async get(programArguments, forSql, forNosql) {
    const requests = CommandGenerateConfigGetter.getRequestList(programArguments);
    return new this.GeneralPrompter(requests, programArguments).getConfig(forSql, forNosql);
  }
}

module.exports = CommandGenerateConfigGetter;
