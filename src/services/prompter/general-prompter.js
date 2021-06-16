const Context = require('@forestadmin/context');
const ApplicationPrompts = require('./application-prompts');
const { DatabasePrompts } = require('./database-prompts');
const ProjectPrompts = require('./project-prompts');
const PromptError = require('./prompter-error');
const Terminator = require('../../utils/terminator-sender');

class GeneralPrompter {
  constructor(requests, programArguments) {
    this.prompts = [];
    this.programArguments = programArguments;
    this.knownAnswers = {};

    this.projectPrompt = new ProjectPrompts(
      requests, this.knownAnswers, this.prompts, programArguments,
    );
    this.databasePrompt = new DatabasePrompts(
      requests, this.knownAnswers, this.prompts, programArguments,
    );
    this.applicationPrompt = new ApplicationPrompts(
      requests, this.knownAnswers, this.prompts, programArguments,
    );
  }

  async getConfig() {
    const { inquirer } = Context.inject();

    try {
      await this.projectPrompt.handlePrompts();
      await this.databasePrompt.handlePrompts();
      await this.applicationPrompt.handlePrompts();
    } catch (error) {
      if (error instanceof PromptError) {
        await Terminator.terminate(1, {
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          logs: error.logs,
        });
      } else {
        throw error;
      }
    }

    this.promptAnswers = await inquirer.prompt(this.prompts);

    this.cleanConfigOptions();

    return { ...this.programArguments, ...this.knownAnswers, ...this.promptAnswers };
  }

  cleanConfigOptions() {
    if (!this.promptAnswers) { return; }

    // NOTICE: Remove the database password if not set.
    if (!this.promptAnswers.databasePassword) {
      delete this.promptAnswers.databasePassword;
    }
  }
}

module.exports = GeneralPrompter;
