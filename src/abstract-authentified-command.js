const { Command } = require('@oclif/command');
const authenticator = require('./services/authenticator');

class AbstractAuthentifiedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      return this.error('🔥  You need to be logged in to execute this command 🔥', { exit: 10 });
    }

    return this.runIfAuthentified();
  }

  async runIfAuthentified() {
    throw new Error(`'runIfAuthentified' is not implemented on ${this.constructor.name}`);
  }
}

module.exports = AbstractAuthentifiedCommand;
