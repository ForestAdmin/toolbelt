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

  static getRequestList(programArguments, forSql, forNosql) {
    let requestList;
    if (programArguments.databaseConnectionURL) {
      requestList = REQUESTS.forConnectionUrl;
    } else {
      requestList = REQUESTS.forFullPrompt;
    }

    // This is the only way we can know if the command is for agent-nodejs project.
    // For other commands, the language is not supported.
    return forSql !== forNosql ? [...requestList, 'language'] : requestList;
  }

  async get(programArguments, forSql, forNosql) {
    const requests = CommandGenerateConfigGetter.getRequestList(programArguments, forSql, forNosql);
    return new this.GeneralPrompter(requests, programArguments).getConfig(forSql, forNosql);
  }
}

module.exports = CommandGenerateConfigGetter;
