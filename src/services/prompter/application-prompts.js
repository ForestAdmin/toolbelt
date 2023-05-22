const { default: languages, languageList } = require('../../utils/languages');
const { validateAppHostname, validatePort } = require('../../utils/validators');
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
          validate: validateAppHostname,
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
          validate: validatePort,
        });
      }
    }
  }

  handleLanguage() {
    if (this.isOptionRequested('language')) {
      this.knownAnswers.language = languageList.find(
        language => language.name === this.programArguments.language,
      );

      if (!this.knownAnswers.language) {
        this.prompts.push({
          type: 'list',
          name: 'language',
          message: 'In which language would you like to generate your sources?',
          choices: languageList.map(language => ({
            name: language.name,
            value: language,
          })),
          default: languages.Javascript,
        });
      }
    } else {
      this.knownAnswers.language = null;
    }
  }
}

module.exports = ApplicationPrompts;
