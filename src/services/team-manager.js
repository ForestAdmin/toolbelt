const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * Read access to a project's teams.
 * Future `forest teams:*` commands (PRD-528/529) should extend this manager
 * with write operations rather than re-implementing the HTTP calls.
 * @param {{ projectId: number | string }} config
 */
function TeamManager(config) {
  const { assertPresent, authenticator, env } = Context.inject();
  assertPresent({ authenticator, env });

  this.listForProject = async () => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .get(`${env.FOREST_SERVER_URL}/api/projects/${config.projectId}/teams`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send();

    return (response.body.data || []).map(team => ({
      id: team.id,
      name: team.attributes.name,
    }));
  };

  /**
   * Create a new team in the project.
   * @param {string} name
   * @param {string|number} projectId
   * @returns {Promise<{ id: string, name: string }>}
   */
  this.createTeam = async (name, projectId) => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .post(`${env.FOREST_SERVER_URL}/api/teams`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send({
        data: {
          type: 'teams',
          attributes: { name },
          relationships: {
            project: { data: { id: String(projectId), type: 'projects' } },
          },
        },
      });

    const { data } = response.body;
    if (!data || !data.attributes) {
      throw new Error('Unexpected response when creating team: missing data.attributes.');
    }
    return {
      id: data.id,
      name: data.attributes.name,
    };
  };
}

module.exports = TeamManager;
