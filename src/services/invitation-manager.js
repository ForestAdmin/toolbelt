const agent = require('superagent');
const Context = require('@forestadmin/context');

/**
 * @param {{ projectId: number | string }} config
 */
function InvitationManager(config) {
  const { assertPresent, authenticator, env } = Context.inject();
  assertPresent({ authenticator, env });

  /**
   * @param {Array<{
   *  email: string;
   *  teamId: number | string;
   *  roleId: number | string;
   *  permissionLevel: string;
   * }>} invitations
   */
  this.inviteUsers = async invitations => {
    const authToken = authenticator.getAuthToken();

    const data = invitations.map(invitation => ({
      type: 'invitations',
      attributes: {
        email: invitation.email,
        'permission-level': invitation.permissionLevel,
      },
      relationships: {
        team: { data: { type: 'teams', id: String(invitation.teamId) } },
        role: { data: { type: 'roles', id: String(invitation.roleId) } },
      },
    }));

    return agent
      .post(`${env.FOREST_SERVER_URL}/api/invitations`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send({ data })
      .then(response => response.body);
  };
}

module.exports = InvitationManager;
