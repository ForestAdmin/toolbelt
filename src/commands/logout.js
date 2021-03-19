const { Command } = require('@oclif/command');
const context = require('../context');

class LogoutCommand extends Command {
  constructor(...args) {
    super(...args);
    /** @type {import('../context/init').Context} */
    const { authenticator } = context.inject();

    /** @private @readonly */
    this.authenticator = authenticator;

    if (!this.authenticator) throw new Error('Missing dependency authenticator');
  }

  async run() {
    await this.authenticator.logout({ log: true });
  }
}

LogoutCommand.description = 'Sign out of your account.';

module.exports = LogoutCommand;
