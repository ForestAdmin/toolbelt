const { default: languages } = require('../../utils/languages');
const AbstractPrompter = require('./abstract-prompter');

class ApplicationPrompts extends AbstractPrompter {
  constructor(requests, knownAnswers, prompts, programArguments) {
    super(requests);
    this.knownAnswers = knownAnswers;
    this.prompts = prompts;
    this.programArguments = programArguments;
  }

  async handlePrompts() {
    this.handleHostname();
    this.handlePort();
    this.handleLanguage();
  }

  handleHostname() {
    if (this.isOptionRequested('appHostname')) {
      this.knownAnswers.applicationHost = this.programArguments.applicationHost;
      if (!this.programArguments.applicationHost && !this.knownAnswers.applicationHost) {
        this.prompts.push({
          type: 'input',
          name: 'applicationHost',
          message: "What's the IP/hostname on which your application will be running?",
          default: 'http://localhost',
          validate: hostname => {
            if (!/^https?:\/\/.*/i.test(hostname)) {
              return 'Application hostname must be a valid url.';
            }
            if (!/^http((s:\/\/.*)|(s?:\/\/(localhost|127\.0\.0\.1).*))/i.test(hostname)) {
              return 'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.';
            }
            return true;
          },
        });
      }
    }
  }

  handlePort() {
    if (this.isOptionRequested('appPort')) {
      this.knownAnswers.applicationPort = this.programArguments.applicationPort;
      if (!this.programArguments.applicationPort && !this.knownAnswers.applicationPort) {
        this.prompts.push({
          type: 'input',
          name: 'applicationPort',
          message: "What's the port on which your application will be running?",
          default: '3310',
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
  }

  handleLanguage() {
    if (this.isOptionRequested('javascript')) {
      this.knownAnswers.language =
        typeof this.programArguments.typescript === 'boolean' && this.programArguments.typescript
          ? languages.Typescript
          : languages.Javascript;

      if (!this.knownAnswers.language) {
        this.prompts.push({
          type: 'list',
          name: 'language',
          message: 'What language do you want to use?',
          choices: [
            { name: 'javascript', value: languages.Javascript },
            { name: 'typescript', value: languages.Typescript },
          ],
          default: languages.Javascript,
        });
      }
    }
  }
}

module.exports = ApplicationPrompts;
