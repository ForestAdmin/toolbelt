class ProjectCreator {
  constructor({
    assertPresent,
    api,
    chalk,
    keyGenerator,
    messages,
    terminatorSender,
  }) {
    assertPresent({
      api,
      chalk,
      keyGenerator,
      messages,
      terminatorSender,
    });
    this.api = api;
    this.chalk = chalk;
    this.keyGenerator = keyGenerator;
    this.messages = messages;
    this.terminatorSender = terminatorSender;
  }

  async create(sessionToken, config) {
    try {
      const newProjectPayload = { name: config.applicationName };
      const newProject = await this.api.createProject(config, sessionToken, newProjectPayload);

      return {
        envSecret: newProject.defaultEnvironment.secretKey,
        authSecret: this.keyGenerator.generate(),
      };
    } catch (error) {
      let message;
      if (error.message === 'Unauthorized') {
        message = `Your session has expired. Please log back in with the command ${this.chalk.cyan('lumber login')}.`;
      } else if (error.message === 'Conflict') {
        message = 'A project with this name already exists. Please choose another name.';
      } else {
        message = `${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(error)}`;
      }

      return this.terminatorSender.terminate(1, {
        logs: [message],
      });
    }
  }
}

module.exports = ProjectCreator;
