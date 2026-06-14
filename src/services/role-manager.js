const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * Read access to a project's roles.
 * Future `forest roles:*` commands (PRD-528/529) should extend this manager
 * with write operations rather than re-implementing the HTTP calls.
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
}

module.exports = RoleManager;
