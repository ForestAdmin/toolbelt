const { flags } = require('@oclif/command');
const Context = require('@forestadmin/context');
const plan = require('../context/init');
const AbstractCommand = require('../abstract-command');

class LoginCommand extends AbstractCommand {
  init(context) {
    this.context = context || Context.execute(plan);
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });

    this.authenticator = authenticator;
    super.init();
  }

  async run() {
    const { flags: config } = this.parse(LoginCommand);
    await this.authenticator.tryLogin(config);
  }
}

LoginCommand.description = 'Sign in with an existing account.';

LoginCommand.flags = {
  email: flags.string({
    char: 'e',
    description: 'Your Forest Admin account email.',
  }),
  password: flags.string({
    char: 'P',
    description: 'Your Forest Admin account password (ignored if token is set).',
  }),
  token: flags.string({
    char: 't',
    description: 'Your Forest Admin account token (replaces password).',
  }),
};

module.exports = LoginCommand;
