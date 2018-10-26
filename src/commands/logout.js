const {Command, flags} = require('@oclif/command')
const authenticator = require('../services/authenticator');

class LogoutCommand extends Command {
  async run() {
    await authenticator.logout({ log: true });
  }
}

LogoutCommand.description = `Sign out of your account.`

module.exports = LogoutCommand
