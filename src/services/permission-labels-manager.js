const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * Read access to the names a team's layout shows for an environment's collections
 * and smart actions.
 * @param {{ projectId: number | string }} config
 */
function PermissionLabelsManager(config) {
  const { assertPresent, authenticator, env } = Context.inject();
  assertPresent({ authenticator, env });

  /**
   * @param {string|number} environmentId
   * @param {string|number} teamId
   * @returns {Promise<{ collections: Array<{ name: string, displayName: string,
   *   actions: Array<{ name: string, displayName: string }> }> }>}
   */
  this.getForTeam = async (environmentId, teamId) => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .get(`${env.FOREST_SERVER_URL}/api/environments/${environmentId}/permission-labels`)
      .query({ teamId })
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send();

    return { collections: response.body?.collections || [] };
  };
}

module.exports = PermissionLabelsManager;
