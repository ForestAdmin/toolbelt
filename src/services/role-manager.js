const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * Read/write access to a project's roles.
 * PRD-528/535: extended with write operations for `forest roles:*` commands.
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
    if (!data || !data.attributes) {
      throw new Error(`Unexpected response for role ${roleId}: missing data.attributes.`);
    }
    return {
      id: data.id,
      name: data.attributes.name,
      permissions: data.attributes.permissions || {},
    };
  };

  /**
   * Create a new role in the project.
   * @param {string} name
   * @param {string|number} projectId
   * @returns {Promise<{ id: string, name: string }>}
   */
  this.createRole = async (name, projectId) => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .post(`${env.FOREST_SERVER_URL}/api/roles`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send({
        data: {
          type: 'roles',
          attributes: {
            name,
            initialize_permissions_from: { roleId: null, everythingAllowed: false },
          },
          relationships: {
            project: { data: { id: String(projectId), type: 'projects' } },
          },
        },
      });

    const { data } = response.body;
    return {
      id: data.id,
      name: data.attributes.name,
    };
  };

  /**
   * Apply RFC-6902 JSON Patch ops to a role's permissions.
   * @param {string|number} roleId
   * @param {Array<{ op: string, path: string, value: unknown }>} ops
   * @returns {Promise<void>}
   */
  this.patchPermissions = async (roleId, ops) => {
    const authToken = authenticator.getAuthToken();

    await agent
      .patch(`${env.FOREST_SERVER_URL}/api/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(ops);
  };

  /**
   * Copy all permissions from one environment to another within the project.
   * @param {string|number} fromEnvId
   * @param {string|number} toEnvId
   * @returns {Promise<void>}
   */
  this.copyPermissions = async (fromEnvId, toEnvId) => {
    const authToken = authenticator.getAuthToken();

    await agent
      .post(`${env.FOREST_SERVER_URL}/api/projects/${config.projectId}/roles/copy-permissions`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send({ from: String(fromEnvId), to: String(toEnvId) });
  };
}

module.exports = RoleManager;
