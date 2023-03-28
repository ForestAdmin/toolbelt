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
const REQUESTS_LANGUAGE = ['javascript', 'typescript'];

const REQUESTS = {
  forConnectionUrl: ['dbConnectionUrl', ...REQUESTS_DATABASE_OPTIONAL, ...REQUESTS_APPLICATION],
  forFullPrompt: [
    ...REQUESTS_DATABASE_MANDATORY,
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
  ],
};

const REQUESTS_WITH_LANGUAGE = {
  forConnectionUrl: [
    'dbConnectionUrl',
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
    ...REQUESTS_LANGUAGE,
  ],
  forFullPrompt: [
    ...REQUESTS_DATABASE_MANDATORY,
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
    ...REQUESTS_LANGUAGE,
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
    const AVAILABLE_REQUESTS =
      typeof programArguments.javascript === 'boolean' ? REQUESTS_WITH_LANGUAGE : REQUESTS;

    if (programArguments.databaseConnectionURL) {
      return AVAILABLE_REQUESTS.forConnectionUrl;
    }
    return AVAILABLE_REQUESTS.forFullPrompt;
  }

  async get(programArguments, forSql, forNosql) {
    const requests = CommandGenerateConfigGetter.getRequestList(programArguments);
    return new this.GeneralPrompter(requests, programArguments).getConfig(forSql, forNosql);
  }
}

module.exports = CommandGenerateConfigGetter;
