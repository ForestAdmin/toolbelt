const { Command } = require('@oclif/command');
const authenticator = require('../services/authenticator');

class LogoutCommand extends Command {
  static async run() {
    await authenticator.logout({ log: true });
  }
}

LogoutCommand.description = 'sign out of your account';

module.exports = LogoutCommand;
