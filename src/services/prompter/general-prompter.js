const _ = require('lodash');
const Context = require('@forestadmin/context');
const ApplicationPrompt = require('./application-prompts');
const DatabasePrompt = require('./database-prompts');
const ProjectPrompt = require('./project-prompts');
const PromptError = require('./prompter-error');
const UserPrompt = require('./user-prompts');
const Terminator = require('../../utils/terminator-sender');

class GeneralPrompter {
  constructor(requests, program) {
    this.prompts = [];
    this.program = program;
    this.env = {};

    this.projectPrompt = new ProjectPrompt(requests, this.env, program);
    this.databasePrompt = new DatabasePrompt(requests, this.env, this.prompts, program);
    this.applicationPrompt = new ApplicationPrompt(requests, this.env, this.prompts, program);
    this.userPrompt = new UserPrompt(requests, this.env, this.prompts, program);

    this.initSourceDirectory();
  }

  initSourceDirectory() {
    if (this.program.sourceDirectory) {
      this.env.sourceDirectory = this.program.sourceDirectory;
    } else {
      this.env.sourceDirectory = process.cwd();
    }
  }

  async getConfig() {
    const { inquirer } = Context.inject();

    try {
      await this.projectPrompt.handlePrompts();
      await this.databasePrompt.handlePrompts();
      await this.applicationPrompt.handlePrompts();
      await this.userPrompt.handlePrompts();
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

    this.config = await inquirer.prompt(this.prompts);

    this.cleanConfigOptions();

    return _.merge(this.config, this.env);
  }

  cleanConfigOptions() {
    if (!this.config) { return; }

    // NOTICE: Remove the dbPassword if there's no password for the DB
    // connection.
    if (!this.config.dbPassword) { delete this.config.dbPassword; }
  }
}

module.exports = GeneralPrompter;
