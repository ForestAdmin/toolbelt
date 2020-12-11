const { Command } = require('@oclif/command');
const context = require('../context');

const { authenticator } = context.inject();

class LogoutCommand extends Command {
  static async run() {
    await authenticator.logout({ log: true });
  }
}

LogoutCommand.description = 'Sign out of your account.';

module.exports = LogoutCommand;
