import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import InvitationManager from '../../services/invitation-manager';
import RoleManager from '../../services/role-manager';
import TeamManager from '../../services/team-manager';
import withCurrentProject from '../../services/with-current-project';

const PERMISSION_LEVELS = ['admin', 'editor', 'user', 'developer', 'manager'];

type NamedEntity = { id: number | string; name: string };

export default class UsersInviteCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private inquirer: { prompt: (questions: unknown[]) => Promise<Record<string, unknown>> };

  static override description = 'Invite users to a project.';

  static override flags = {
    email: Flags.string({
      char: 'e',
      description: 'Email of the user to invite (repeat the flag to invite several users).',
      required: true,
      multiple: true,
    }),
    team: Flags.string({
      char: 't',
      description: 'Team name to add the invited users to (prompted if omitted and several exist).',
    }),
    role: Flags.string({
      char: 'r',
      description: 'Role name to assign (prompted if omitted and several exist).',
    }),
    'permission-level': Flags.string({
      char: 'l',
      description: 'Permission level of the invited users.',
      options: PERMISSION_LEVELS,
      required: true,
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format.',
      options: ['table', 'json'],
      default: 'table',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  // Resolve a team/role by name (headless when passed as a flag), with the
  // same UX as project selection: auto-pick when there is only one, prompt
  // when several and none provided, clear error listing the valid names.
  private async resolveByName(
    entities: NamedEntity[],
    providedName: string | undefined,
    label: string,
  ): Promise<NamedEntity> {
    if (providedName) {
      const match = entities.find(entity => entity.name === providedName);
      if (match) return match;
      const available = entities.map(entity => entity.name).join(', ') || '(none)';
      this.logger.error(
        `${label} "${providedName}" not found in this project. Available: ${available}.`,
      );
      this.exit(1);
    }

    if (!entities.length) {
      this.logger.error(`No ${label} found in this project.`);
      this.exit(1);
    }
    if (entities.length === 1) return entities[0];

    const { choice } = await this.inquirer.prompt([
      {
        name: 'choice',
        message: `Select a ${label}:`,
        type: 'list',
        choices: entities.map(entity => ({ name: entity.name, value: entity.id })),
      },
    ]);
    return entities.find(entity => entity.id === choice) as NamedEntity;
  }

  async runAuthenticated() {
    const { flags } = await this.parse(UsersInviteCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    try {
      const teams = await new TeamManager(config).listForProject();
      const team = await this.resolveByName(teams, flags.team, 'team');

      const roles = await new RoleManager(config).listForProject();
      const role = await this.resolveByName(roles, flags.role, 'role');

      const invitations = flags.email.map((email: string) => ({
        email,
        teamId: team.id,
        roleId: role.id,
        permissionLevel: flags['permission-level'],
      }));

      const result = await new InvitationManager(config).inviteUsers(invitations);

      if (flags.format === 'json') {
        this.logger.info(JSON.stringify(result, null, 2));
        return;
      }

      this.logger.info(
        `Invited ${invitations.length} user(s) to team "${team.name}" (${
          flags['permission-level']
        }) on project ${config.projectId}: ${flags.email.join(', ')}.`,
      );
    } catch (error) {
      const { response, status } = error as {
        status?: number;
        response?: { text?: string };
      };
      if (response && status !== 403 && response.text) {
        const errorData = JSON.parse(response.text);
        if (errorData?.errors?.[0]?.detail) {
          this.logger.error(errorData.errors[0].detail);
          this.exit(1);
        }
      }
      throw error;
    }
  }
}
