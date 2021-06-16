const GeneralPrompter = require('../../prompter/general-prompter');

const REQUESTS_DATABASE_MANDATORY = [
  'dbDialect',
  'dbName',
  'dbHostname',
  'dbPort',
  'dbUser',
  'dbPassword',
];
const REQUESTS_DATABASE_OPTIONAL = [
  'dbSchema',
  'ssl',
  'mongodbSrv',
];
const REQUESTS_APPLICATION = [
  'applicationName',
  'appHostname',
  'appPort',
];

const REQUESTS = {
  forConnectionUrl: [
    // FIXME: remove this one? it is known in this case
    'dbConnectionUrl',
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
  ],
  forFullPrompt: [
    ...REQUESTS_DATABASE_MANDATORY,
    ...REQUESTS_DATABASE_OPTIONAL,
    ...REQUESTS_APPLICATION,
  ],
};

class CommandGenerateConfigGetter {
  static getRequestList(programArguments) {
    if (programArguments.databaseConnectionURL) {
      return REQUESTS.forConnectionUrl;
    }
    return REQUESTS.forFullPrompt;
  }

  static get(programArguments) {
    const requests = CommandGenerateConfigGetter.getRequestList(programArguments);
    return new GeneralPrompter(
      requests,
      programArguments,
    ).getConfig();
  }
}

module.exports = CommandGenerateConfigGetter;
