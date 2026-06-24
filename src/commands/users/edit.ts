import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import RoleManager from '../../services/role-manager';
import TeamManager from '../../services/team-manager';
import UserManager from '../../services/user-manager';
import withCurrentProject from '../../services/with-current-project';

const PERMISSION_LEVELS = ['admin', 'editor', 'user', 'developer', 'manager'];

type NamedEntity = { id: number | string; name: string };
type ProjectConfig = { projectId: number | string } & Record<string, unknown>;
type EditFlags = {
  email: string;
  role?: string;
  team?: string[];
  'permission-level'?: string;
  force?: boolean;
};

export default class UsersEditCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override description = "Edit a user's role, team(s) or permission level.";

  static override flags = {
    email: Flags.string({
      char: 'e',
      description: 'Email of the user to edit.',
      required: true,
    }),
    role: Flags.string({
      char: 'r',
      description: 'New role name to assign.',
    }),
    team: Flags.string({
      char: 't',
      description:
        'Team name to set for this project. Repeatable; this REPLACES the user’s current team set on the project.',
      multiple: true,
    }),
    'permission-level': Flags.string({
      char: 'l',
      description: 'New permission level.',
      options: PERMISSION_LEVELS,
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt when teams would be removed.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async runAuthenticated() {
    const { flags } = await this.parse(UsersEditCommand);
    const teamNames = flags.team ?? [];

    if (!flags.role && !teamNames.length && !flags['permission-level']) {
      this.logger.error('At least one of --role, --team or --permission-level is required.');
      this.exit(1);
      return;
    }

    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    try {
      await this.applyEdit(config, flags, teamNames);
    } catch (error) {
      this.surfaceApiError(error);
    }
  }

  private async applyEdit(config: ProjectConfig, flags: EditFlags, teamNames: string[]) {
    const userManager = new UserManager(config);

    const user = await userManager.findByEmail(flags.email);
    if (!user) {
      this.logger.error(`User "${flags.email}" not found in this project.`);
      this.exit(1);
      return;
    }

    const changes: { roleId?: string; teamIds?: string[]; permissionLevel?: string } = {};

    if (flags.role) {
      const roleId = await this.resolveRoleId(config, flags.role);
      if (roleId === null) {
        this.exit(1);
        return;
      }
      changes.roleId = roleId;
    }

    if (teamNames.length) {
      const teamIds = await this.resolveTeamIds(config, teamNames);
      if (teamIds === null) {
        this.exit(1);
        return;
      }

      // --team replaces the project team set, so flag any teams that would be dropped.
      const removed = user.teams.filter(name => !teamNames.includes(name));
      if (removed.length && !flags.force && !(await this.confirmRemoval(flags.email, removed))) {
        this.logger.info('Aborted: no change made.');
        return;
      }
      changes.teamIds = teamIds;
    }

    if (flags['permission-level']) {
      changes.permissionLevel = flags['permission-level'];
    }

    await userManager.editUser(user.id, user.permissionLevel, user.roleId, changes);
    this.logger.info(`User "${flags.email}" updated on project ${config.projectId}.`);
  }

  private async resolveRoleId(config: ProjectConfig, roleName: string): Promise<string | null> {
    const roles: NamedEntity[] = await new RoleManager(config).listForProject();
    const role = roles.find(candidate => candidate.name === roleName);
    if (!role) {
      const available = roles.map(candidate => candidate.name).join(', ') || '(none)';
      this.logger.error(`Role "${roleName}" not found. Available: ${available}.`);

      return null;
    }

    return String(role.id);
  }

  private async resolveTeamIds(config: ProjectConfig, names: string[]): Promise<string[] | null> {
    const teams: NamedEntity[] = await new TeamManager(config).listForProject();
    const byName = new Map(teams.map(team => [team.name, String(team.id)]));
    const missing = names.filter(name => !byName.has(name));
    if (missing.length) {
      const available = teams.map(team => team.name).join(', ') || '(none)';
      this.logger.error(`Team(s) "${missing.join(', ')}" not found. Available: ${available}.`);

      return null;
    }

    return names.map(name => byName.get(name) as string);
  }

  private async confirmRemoval(email: string, removedTeams: string[]): Promise<boolean> {
    const { confirm } = await this.inquirer.prompt([
      {
        message: `This will remove ${email} from team(s): ${removedTeams.join(', ')}. Continue?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    return confirm;
  }

  private surfaceApiError(error: unknown): void {
    // 401/403 keep flowing to the authenticated-command handler.
    const { response, status } = error as { status?: number; response?: { text?: string } };
    if (response && status !== 401 && status !== 403 && response.text) {
      let detail;
      try {
        detail = JSON.parse(response.text)?.errors?.[0]?.detail;
      } catch {
        // Non-JSON error body: fall through and rethrow the original error.
      }
      if (detail) {
        this.logger.error(detail);
        this.exit(1);
        return;
      }
    }

    throw error;
  }
}
