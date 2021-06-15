const AbstractPrompter = require('./abstract-prompter');

class UserPrompts extends AbstractPrompter {
  constructor(requests, env, prompts, program) {
    super(requests);
    this.env = env;
    this.prompts = prompts;
    this.program = program;
  }

  async handlePrompts() {
    this.handleEmail();
    this.handlePassword();
    this.handleToken();
  }

  handleEmail() {
    if (this.isOptionRequested('email')) {
      this.env.email = this.program.email;

      if (!this.env.email) {
        this.prompts.push({
          type: 'input',
          name: 'email',
          message: 'What\'s your email address? ',
          validate: (email) => {
            if (email) { return true; }
            return 'Please enter your email address.';
          },
        });
      }
    }
  }

  handlePassword() {
    this.env.password = this.program.password;
  }

  handleToken() {
    this.env.token = this.program.token;
  }
}

module.exports = UserPrompts;
