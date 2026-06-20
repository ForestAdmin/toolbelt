const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * Read access to a project's roles.
 * PRD-535: extended with `getRoleById` for `forest roles:export`.
 * Write operations (create / patch / copy permissions) land with `forest roles:apply` (PRD-528).
 * @param {{ projectId: number | string }} config
 */
function RoleManager(config) {
  const { assertPresent, authenticator, env } = Context.inject();
  assertPresent({ authenticator, env });

  this.listForProject = async () => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .get(`${env.FOREST_SERVER_URL}/api/projects/${config.projectId}/roles`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send();

    return (response.body.data || []).map(role => ({
      id: role.id,
      name: role.attributes.name,
    }));
  };

  /**
   * Fetch a single role with its full permissions object.
   * @param {string|number} roleId
   * @returns {Promise<{ id: string, name: string, permissions: object }>}
   */
  this.getRoleById = async roleId => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .get(`${env.FOREST_SERVER_URL}/api/roles/${roleId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send();

    const { data } = response.body;
    return {
      id: data.id,
      name: data.attributes.name,
      permissions: data.attributes.permissions || {},
    };
  };
}

module.exports = RoleManager;
