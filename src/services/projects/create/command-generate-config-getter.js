const Prompter = require('../../prompter/general-prompter');

const OPTIONS_DATABASE_MANDATORY = [
  'dbDialect',
  'dbName',
  'dbHostname',
  'dbPort',
  'dbUser',
  'dbPassword',
];
const OPTIONS_DATABASE_OPTIONAL = [
  'dbSchema',
  'ssl',
  'mongodbSrv',
];
const OPTIONS_APPLICATION = [
  'applicationName',
  'appHostname',
  'appPort',
];

const OPTIONS = {
  forConnectionUrl: [
    'dbConnectionUrl',
    ...OPTIONS_DATABASE_OPTIONAL,
    ...OPTIONS_APPLICATION,
  ],
  forFullPrompt: [
    ...OPTIONS_DATABASE_MANDATORY,
    ...OPTIONS_DATABASE_OPTIONAL,
    ...OPTIONS_APPLICATION,
  ],
};

class CommandGenerateConfigGetter {
  static getOptions(args) {
    if (args.connectionUrl) {
      return OPTIONS.forConnectionUrl;
    }
    return OPTIONS.forFullPrompt;
  }

  static get(args) {
    return new Prompter(
      CommandGenerateConfigGetter.getOptions(args), args,
    ).getConfig();
  }
}

module.exports = CommandGenerateConfigGetter;
