const chalk = require('chalk');
const DirectoryExistenceChecker = require('../../utils/directory-existence-checker');
const AbstractPrompter = require('./abstract-prompter');
const PrompterError = require('./prompter-error');
const messages = require('../../utils/messages');

class ProjectPrompts extends AbstractPrompter {
  constructor(requests, knownAnswers, prompts, programArguments) {
    super(requests);
    this.knownAnswers = knownAnswers;
    this.prompts = prompts;
    this.programArguments = programArguments;
  }

  async handlePrompts() {
    await this.handleName();
  }

  async handleName() {
    if (this.isOptionRequested('applicationName')) {
      const projectName = this.programArguments.applicationName;

      if (!projectName) {
        throw new PrompterError(
          messages.ERROR_MISSING_PROJECT_NAME,
          [
            messages.ERROR_MISSING_PROJECT_NAME,
            messages.HINT_MISSING_PROJECT_NAME,
          ],
        );
      } else if (new DirectoryExistenceChecker(projectName).perform()) {
        const message = `File or directory "${chalk.red(`${projectName}`)}" already exists.`;
        throw new PrompterError(
          message,
          [
            message,
            messages.HINT_DIRECTORY_ALREADY_EXISTS,
          ],
        );
      } else {
        this.knownAnswers.applicationName = projectName;
      }
    }
  }
}

module.exports = ProjectPrompts;
