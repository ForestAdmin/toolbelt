import Context from '@forestadmin/context';
import agent from 'superagent';

export type ProjectUser = {
  id: string;
  email: string;
  name: string;
  permissionLevel: string;
  roleId: string | null;
  role: string | null;
  teams: string[];
};

/** Minimal JSON:API resource shape (the users endpoints use snake_case attributes). */
type ApiResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: unknown }>;
};

type UserManagerContext = {
  assertPresent: (dependencies: Record<string, unknown>) => void;
  authenticator: { getAuthToken(): string };
  env: { FOREST_SERVER_URL: string };
  logger: { warn(...messages: unknown[]): void };
};

// No bulk endpoint for teams/role, so enrich per-user — bound the fan-out.
const ENRICH_CONCURRENCY = 5;

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop -- bounded worker: one task at a time per worker
      results[index] = await fn(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

export default class UserManager {
  private readonly config: { projectId: number | string };

  private readonly authenticator: UserManagerContext['authenticator'];

  private readonly env: UserManagerContext['env'];

  private readonly logger: UserManagerContext['logger'];

  constructor(config: { projectId: number | string }) {
    this.config = config;
    const { assertPresent, authenticator, env, logger } = Context.inject() as UserManagerContext;
    assertPresent({ authenticator, env, logger });
    this.authenticator = authenticator;
    this.env = env;
    this.logger = logger;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.authenticator.getAuthToken()}`,
      'forest-project-id': String(this.config.projectId),
    };
  }

  async listForProject(): Promise<ProjectUser[]> {
    const users = await this.requestUsers();

    return mapWithConcurrency(users, ENRICH_CONCURRENCY, user => this.toProjectUser(user));
  }

  /** Raw project-users list (one call, no enrichment). Failures surface to the caller. */
  private async requestUsers(): Promise<ApiResource[]> {
    const response = await agent
      .get(`${this.env.FOREST_SERVER_URL}/api/projects/${this.config.projectId}/users`)
      .set(this.headers())
      .send();

    return (response.body?.data ?? []) as ApiResource[];
  }

  private async toProjectUser(user: ApiResource, strict = false): Promise<ProjectUser> {
    const attributes = user.attributes ?? {};
    const userId = user.id ? String(user.id) : '';

    const [teams, role] = await Promise.all([
      this.fetchTeams(userId, strict),
      this.fetchRole(userId, strict),
    ]);

    return {
      id: userId,
      email: String(attributes.email ?? ''),
      name: [attributes.first_name, attributes.last_name].filter(Boolean).join(' '),
      permissionLevel: String(attributes.permission_level ?? ''),
      roleId: role.id,
      role: role.name,
      teams,
    };
  }

  /**
   * Resolve a project user by email for the edit path. Returns undefined when no
   * user matches; transport/API failures throw. The role/teams are read in `strict`
   * mode (never degraded): the edit reassigns the role and replaces the teams from
   * these values, so a failed read must abort the edit, not silently wipe them.
   */
  async findByEmail(email: string): Promise<ProjectUser | undefined> {
    const users = await this.requestUsers();
    const match = users.find(user => String(user.attributes?.email ?? '') === email);
    if (!match) return undefined;

    return this.toProjectUser(match, true);
  }

  async editUser(
    userId: string,
    currentPermissionLevel: string,
    currentRoleId: string | null,
    changes: { roleId?: string; teamIds?: string[]; permissionLevel?: string },
  ): Promise<void> {
    const effectiveRoleId = changes.roleId ?? currentRoleId;
    // Ids are sent as integers: the server's update validator requires
    // `id: number` for data/role/teams/projects on this route.
    const relationships: Record<string, unknown> = {
      projects: { data: [{ type: 'projects', id: Number(this.config.projectId) }] },
      ...(effectiveRoleId && { role: { data: { type: 'roles', id: Number(effectiveRoleId) } } }),
    };
    if (changes.teamIds) {
      relationships.teams = {
        data: changes.teamIds.map(id => ({ type: 'teams', id: Number(id) })),
      };
    }

    await agent
      .put(`${this.env.FOREST_SERVER_URL}/api/users/${userId}`)
      .set(this.headers())
      .send({
        data: {
          type: 'users',
          id: Number(userId),
          attributes: { permission_level: changes.permissionLevel ?? currentPermissionLevel },
          relationships,
        },
      });
  }

  // `strict` is used by the edit path: a failed read must surface (abort the edit)
  // rather than degrade, since the edit writes these values back.
  private async fetchTeams(userId: string, strict = false): Promise<string[]> {
    if (!userId) return [];

    try {
      const response = await agent
        .get(`${this.env.FOREST_SERVER_URL}/api/users/${userId}/teams`)
        .set(this.headers())
        .send();

      return ((response.body?.data ?? []) as ApiResource[])
        .map(team => String(team.attributes?.name ?? ''))
        .filter(Boolean);
    } catch (error) {
      if (strict) throw error;
      this.logger.warn(`Could not fetch teams for user ${userId} (showing none): ${error}`);

      return [];
    }
  }

  private async fetchRole(
    userId: string,
    strict = false,
  ): Promise<{ id: string | null; name: string | null }> {
    if (!userId) return { id: null, name: null };

    try {
      const response = await agent
        .get(`${this.env.FOREST_SERVER_URL}/api/users`)
        .query({ projectId: this.config.projectId, id: userId, include: 'role' })
        .set(this.headers())
        .send();

      const role = ((response.body?.included ?? []) as ApiResource[]).find(
        resource => resource.type === 'roles',
      );
      const name = role?.attributes?.name;

      return { id: role?.id ?? null, name: typeof name === 'string' ? name : null };
    } catch (error) {
      if (strict) throw error;
      this.logger.warn(`Could not fetch role for user ${userId} (showing none): ${error}`);

      return { id: null, name: null };
    }
  }
}
