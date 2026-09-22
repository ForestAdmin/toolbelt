/**
 * @typedef {{
 *  agent: string;
 *  dbDialect: string;
 *  architecture: string;
 *  isLocal: boolean;
 * }} ProjectMeta
 *
 * @typedef {{
 *  appName: string
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
  constructor({ assertPresent, api, chalk, keyGenerator, messages, terminator }) {
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
   * @returns {Promise<{
   *   id: number|string, envSecret: string, authSecret: string, endpoint: string
   * }>}
   */
  async create(sessionToken, config, meta) {
    try {
      const newProjectPayload = {
        name: config.appName,
        agent: meta.agent,
        architecture: meta.architecture,
        databaseType: meta.dbDialect,
      };

      const newProject = await this.api.createProject(config, sessionToken, newProjectPayload);

      return {
        id: newProject.id,
        envSecret: newProject.defaultEnvironment.secretKey,
        authSecret: this.keyGenerator.generate(),
        // The endpoint the API just registered for the dev environment. It is built
        // from defaulted host and port, so a caller that never saw a prompt (see
        // `--format json`) has no other way to learn where its panel will point.
        endpoint: newProject.defaultEnvironment.apiEndpoint,
      };
    } catch (error) {
      if (error.message === 'Conflict') {
        error.message = 'A project with this name already exists. Please choose another name.';
      }

      throw error;
    }
  }
}

module.exports = ProjectCreator;
