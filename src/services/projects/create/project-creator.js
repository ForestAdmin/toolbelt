const InvalidOptionError = require('../../../errors/options/invalid-option-error');
const { invitationRefusal } = require('../../invitation-claim');

const ORGANIZATION_REFUSALS = [
  'UserNotOwnerOfOrganizationError',
  'OrganizationAccessForbiddenError',
];

/**
 * @typedef {{
 *  agent: string;
 *  dbDialect: string;
 *  architecture: string;
 *  isLocal: boolean;
 *  organizationId?: number;
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
   * @param {string} [invitationClaim]
   * @returns {Promise<{
   *   id: number|string, envSecret: string, authSecret: string, endpoint: string
   * }>}
   */
  async create(sessionToken, config, meta, invitationClaim) {
    try {
      const newProjectPayload = {
        name: config.appName,
        agent: meta.agent,
        architecture: meta.architecture,
        databaseType: meta.dbDialect,
        ...(meta.organizationId && { organization: { id: meta.organizationId } }),
        ...(invitationClaim ? { invitationClaim } : {}),
      };

      const newProject = await this.api.createProject(config, sessionToken, newProjectPayload);

      if (meta.organizationId && Number(newProject.organizationId) !== meta.organizationId) {
        throw new InvalidOptionError(
          `A project named "${config.appName}" already exists outside organization ${meta.organizationId}. Please choose another name.`,
        );
      }

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
      if (error.message === 'Conflict' && !invitationRefusal(error)) {
        error.message = 'A project with this name already exists. Please choose another name.';
      }

      const serverError = error.response?.body?.errors?.[0];

      if (meta.organizationId && ORGANIZATION_REFUSALS.includes(serverError?.name)) {
        const reason =
          typeof serverError.detail === 'string'
            ? serverError.detail.replace(/\.$/, '')
            : 'you are not an owner of this organization';
        throw new InvalidOptionError(
          `Cannot create the project in organization ${meta.organizationId}: ${reason}.`,
        );
      }

      throw error;
    }
  }
}

module.exports = ProjectCreator;
