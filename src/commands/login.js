const { Command } = require('@oclif/command');
const program = require('commander');
const inquirer = require('inquirer');
const authenticator = require('../services/authenticator');
const logger = require('../services/logger');
const { EMAIL_REGEX } = require('../utils/regexs');

class LoginCommand extends Command {
  static async run() {
    await authenticator
      .logout({ log: false });

    program
      .description('Log into Forest Admin API')
      .option('-e, --email <email>', 'Your Forest Admin account email')
      .option('-P, --password <password>', 'Your Forest Admin account password (ignored if token is set)')
      .option('-t, --token <token>', 'Your Forest Admin account token (replaces password)')
      .parse(process.argv);

    (async () => {
      let { email } = program;

      if (!email) {
        ({ email } = await inquirer.prompt([{
          type: 'input',
          name: 'email',
          message: 'What\'s your email address?',
          validate: (input) => {
            if (EMAIL_REGEX.test(input)) {
              return true;
            }
            return input ? 'Invalid email' : 'Please enter your email address.';
          },
        }]));
      }

      await authenticator.loginWithEmailOrTokenArgv({ ...program, email });

      logger.success('Login successful');
      process.exit(0);
    })().catch(async (error) => {
      logger.error(error);
      process.exit(1);
    });
  }
}

LoginCommand.description = 'sign in with an existing account';

module.exports = LoginCommand;
