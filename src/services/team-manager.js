const agent = require('superagent');
const Context = require('@forestadmin/context');

const JobStateChecker = require('./job-state-checker');

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
   * Create a new team in the project identified by `config.projectId`.
   * @param {string} name
   * @returns {Promise<{ id: string, name: string }>}
   */
  this.createTeam = async name => {
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
            project: { data: { id: String(config.projectId), type: 'projects' } },
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

  /**
   * Delete a team by its id.
   * @param {string|number} teamId
   * @returns {Promise<void>}
   */
  this.deleteTeam = async teamId => {
    const authToken = authenticator.getAuthToken();

    await agent
      .delete(`${env.FOREST_SERVER_URL}/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send();
  };

  /**
   * Copy the whole layout of one team onto another, within the same project.
   * Asynchronous server-side: posts a deployment request, then polls the job
   * until completion.
   * @param {string|number} fromTeamId
   * @param {string|number} toTeamId
   * @param {(code: number) => void} oclifExit
   * @returns {Promise<boolean>} true when the job completes, false on failure
   */
  this.copyLayout = async (fromTeamId, toTeamId, oclifExit) => {
    const authToken = authenticator.getAuthToken();
    const jobStateChecker = new JobStateChecker('Copying layout', oclifExit);

    const response = await agent
      .post(`${env.FOREST_SERVER_URL}/api/deployment-requests`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send({
        data: {
          type: 'deployment-requests',
          attributes: {
            type: 'team',
            from: Number(fromTeamId),
            to: Number(toTeamId),
          },
        },
      });

    const jobId = response.body?.meta?.job_id;
    if (!jobId) return false;

    return jobStateChecker.check(jobId);
  };
}

module.exports = TeamManager;
