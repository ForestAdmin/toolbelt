const os = require('os');
const AbstractPrompter = require('./abstract-prompter');
const PrompterError = require('./prompter-error');
const messages = require('../../utils/messages');

const MAPPING_DIALECT_TO_PORT = {
  postgres: '5432',
  mysql: '3306',
  mssql: '1433',
  mongodb: '27017',
};

const dbDialectOptions = [
  { name: 'mongodb', value: 'mongodb' },
  { name: 'mssql', value: 'mssql' },
  { name: 'mysql / mariadb', value: 'mysql' },
  { name: 'postgres', value: 'postgres' },
];

class DatabasePrompts extends AbstractPrompter {
  constructor(requests, knownAnswers, prompts, programArguments) {
    super(requests);
    this.knownAnswers = knownAnswers;
    this.prompts = prompts;
    this.programArguments = programArguments;
  }

  async handlePrompts() {
    this.handleConnectionUrl();
    this.handleDialect();
    this.handleName();
    this.handleSchema();
    this.handleHostname();
    this.handlePort();
    this.handleUser();
    this.handlePassword();
    this.handleSsl();
    this.handleMongodbSrv();
  }

  async handleConnectionUrl() {
    if (this.isOptionRequested('dbConnectionUrl')) {
      this.knownAnswers.databaseConnectionURL = this.programArguments.databaseConnectionURL;
      try {
        [, this.knownAnswers.databaseDialect] =
          this.knownAnswers.databaseConnectionURL.match(/(.*):\/\//);
        if (this.knownAnswers.databaseDialect === 'mongodb+srv') {
          this.knownAnswers.databaseDialect = 'mongodb';
        }
      } catch (error) {
        throw new PrompterError(messages.ERROR_NOT_PARSABLE_CONNECTION_URL, [
          messages.ERROR_NOT_PARSABLE_CONNECTION_URL,
        ]);
      }
    }
  }

  handleDialect() {
    if (!this.knownAnswers.databaseDialect) {
      this.knownAnswers.databaseDialect = this.programArguments.databaseDialect;
    }
    if (
      this.isOptionRequested('dbDialect') &&
      this.programArguments.databaseDialect === undefined
    ) {
      const prompt = {
        type: 'list',
        name: 'databaseDialect',
        message: "What's the database type?",
        choices: dbDialectOptions,
      };

      // NOTICE: use a rawlist on Windows because of this issue:
      // https://github.com/SBoudrias/Inquirer.js/issues/303
      if (/^win/.test(os.platform())) {
        prompt.type = 'rawlist';
      }

      this.prompts.push(prompt);
    }
  }

  handleName() {
    if (this.isOptionRequested('dbName') && this.programArguments.databaseName === undefined) {
      this.prompts.push({
        type: 'input',
        name: 'databaseName',
        message: "What's the database name?",
        validate: dbName => {
          if (dbName) {
            return true;
          }
          return 'Please specify the database name.';
        },
      });
    }
  }

  handleSchema() {
    if (!this.knownAnswers.databaseSchema) {
      this.knownAnswers.databaseSchema = this.programArguments.databaseSchema;
    }
    if (this.isOptionRequested('dbSchema') && this.programArguments.databaseSchema === undefined) {
      if (!this.knownAnswers.databaseSchema) {
        this.prompts.push({
          type: 'input',
          name: 'databaseSchema',
          message: "What's the database schema? [optional]",
          description: 'Leave blank by default',
          when: answers => {
            // NOTICE: MongoDB and MySQL do not require a Schema.
            const skipDatabases = ['mongodb', 'mysql'];
            return !skipDatabases.includes(
              answers.databaseDialect || this.knownAnswers.databaseDialect,
            );
          },
          default: answers => {
            if (
              answers.databaseDialect === 'postgres' ||
              this.knownAnswers.databaseDialect === 'postgres'
            ) {
              return 'public';
            }
            return '';
          },
        });
      }
    }
  }

  handleHostname() {
    if (this.isOptionRequested('dbHostname') && this.programArguments.databaseHost === undefined) {
      this.prompts.push({
        type: 'input',
        name: 'databaseHost',
        message: "What's the database hostname?",
        default: 'localhost',
      });
    }
  }

  handlePort() {
    if (this.isOptionRequested('dbPort') && this.programArguments.databasePort === undefined) {
      this.prompts.push({
        type: 'input',
        name: 'databasePort',
        message: "What's the database port?",
        default: args => MAPPING_DIALECT_TO_PORT[args.databaseDialect],
        validate: port => {
          if (!/^\d+$/.test(port)) {
            return 'The port must be a number.';
          }

          const parsedPort = parseInt(port, 10);
          if (parsedPort > 0 && parsedPort < 65536) {
            return true;
          }
          return 'This is not a valid port.';
        },
      });
    }
  }

  handleUser() {
    if (this.isOptionRequested('dbUser') && this.programArguments.databaseUser === undefined) {
      this.prompts.push({
        type: 'input',
        name: 'databaseUser',
        message: "What's the database user?",
        default: args => {
          if (args.databaseDialect === 'mongodb') {
            return undefined;
          }
          return 'root';
        },
      });
    }
  }

  handlePassword() {
    if (
      this.isOptionRequested('dbPassword') &&
      this.programArguments.databasePassword === undefined
    ) {
      this.prompts.push({
        type: 'password',
        name: 'databasePassword',
        message: "What's the database password? [optional]",
      });
    }
  }

  handleSsl() {
    this.knownAnswers.databaseSSL = this.programArguments.databaseSSL;
    if (this.isOptionRequested('ssl') && this.programArguments.databaseSSL === undefined) {
      this.prompts.push({
        type: 'confirm',
        name: 'databaseSSL',
        message: 'Does your database require a SSL connection?',
        default: false,
      });
    }
  }

  handleMongodbSrv() {
    if (this.isOptionRequested('mongodbSrv') && this.programArguments.mongoDBSRV === undefined) {
      this.prompts.push({
        type: 'confirm',
        name: 'mongoDBSRV',
        message: 'Use a SRV connection string?',
        when: answers => answers.databaseDialect === 'mongodb',
        default: false,
      });
    }
  }
}

module.exports = {
  DatabasePrompts,
  dbDialectOptions,
};
