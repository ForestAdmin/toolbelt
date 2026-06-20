import Context from '@forestadmin/context';
import agent from 'superagent';

type ProjectUser = {
  id: string;
  email: string;
  name: string;
  permissionLevel: string;
  teams: string[];
};

type UserManagerContext = {
  authenticator: { getAuthToken(): string };
  env: { FOREST_SERVER_URL: string };
};

export default class UserManager {
  private readonly config: { projectId: number | string };

  private readonly authenticator: UserManagerContext['authenticator'];

  private readonly env: UserManagerContext['env'];

  constructor(config: { projectId: number | string }) {
    this.config = config;
    const { authenticator, env } = Context.inject() as UserManagerContext;
    this.authenticator = authenticator;
    this.env = env;
  }

  async listForProject(): Promise<ProjectUser[]> {
    const authToken = this.authenticator.getAuthToken();
    const headers = {
      Authorization: `Bearer ${authToken}`,
      'forest-project-id': String(this.config.projectId),
    };

    const response = await agent
      .get(`${this.env.FOREST_SERVER_URL}/api/projects/${this.config.projectId}/users`)
      .set(headers)
      .send();

    const users: Array<Record<string, any>> = response.body.data || [];

    return Promise.all(
      users.map(async user => {
        const teamsResponse = await agent
          .get(`${this.env.FOREST_SERVER_URL}/api/users/${user.id}/teams`)
          .set(headers)
          .send();

        const teams: string[] = (teamsResponse.body.data || []).map(
          (t: Record<string, any>) => t.attributes.name as string,
        );

        return {
          id: user.id as string,
          email: user.attributes.email as string,
          name: [user.attributes.first_name, user.attributes.last_name].filter(Boolean).join(' '),
          permissionLevel: user.attributes.permission_level as string,
          teams,
        };
      }),
    );
  }
}
