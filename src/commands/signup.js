const { Flags } = require('@oclif/core');
const AbstractCommand = require('../abstract-command').default;

class SignupCommand extends AbstractCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });
    this.authenticator = authenticator;
  }

  async run() {
    const { flags } = await this.parse(SignupCommand);
    await this.authenticator.trySignup({
      email: flags.email,
      password: flags.password,
      firstName: flags['first-name'],
      lastName: flags['last-name'],
    });
  }
}

SignupCommand.description = 'Create a new Forest Admin account.';

SignupCommand.flags = {
  email: Flags.string({
    char: 'e',
    description: 'Your Forest Admin account email.',
  }),
  password: Flags.string({
    char: 'P',
    description: 'Your Forest Admin account password.',
  }),
  'first-name': Flags.string({
    description: 'Your first name.',
  }),
  'last-name': Flags.string({
    description: 'Your last name.',
  }),
};

module.exports = SignupCommand;
