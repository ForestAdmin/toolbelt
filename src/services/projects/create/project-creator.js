/**
 * @typedef {{
 *  agent: string;
 *  dbDialect: string;
 *  architecture: string;
 *  isLocal: boolean;
 * }} ProjectMeta
 *
 * @typedef {{
 *  applicationName: string
 *  appHostname: string
 *  appPort: number
 * }} ProjectConfig
 */

class ProjectCreator {
  /**
   * @param {{
   *   api: import('../../api')
   *   chalk: import('chalk')
   *   keyGenerator: import('../../../utils/key-generator')
   *   messages: import('../../../utils/messages')
   *   terminator: import('../../../utils/terminator')
   * }} dependencies
   */
  constructor({
    assertPresent,
    api,
    chalk,
    keyGenerator,
    messages,
    terminator,
  }) {
    assertPresent({
      api,
      chalk,
      keyGenerator,
      messages,
      terminator,
    });
    this.api = api;
    this.chalk = chalk;
    this.keyGenerator = keyGenerator;
    this.messages = messages;
    this.terminator = terminator;
  }

  /**
   * @param {string} sessionToken
   * @param {{
   *
   * }} config
   * @param {ProjectMeta} meta
   * @returns {Promise<void>}
   */
  async create(sessionToken, config, meta) {
    try {
      const newProjectPayload = {
        name: config.applicationName,
        agent: meta.agent,
        architecture: meta.architecture,
        databaseType: meta.dbDialect,
      };

      const newProject = await this.api.createProject(config, sessionToken, newProjectPayload);

      return {
        id: newProject.id,
        envSecret: newProject.defaultEnvironment.secretKey,
        authSecret: this.keyGenerator.generate(),
      };
    } catch (error) {
      let message;
      if (error.message === 'Unauthorized') {
        message = `Your session has expired. Please log back in with the command \`${this.chalk.cyan('forest login')}\`.`;
      } else if (error.message === 'Conflict') {
        message = 'A project with this name already exists. Please choose another name.';
      } else {
        message = `${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(error)}`;
      }

      return this.terminator.terminate(1, {
        logs: [message],
      });
    }
  }
}

module.exports = ProjectCreator;
