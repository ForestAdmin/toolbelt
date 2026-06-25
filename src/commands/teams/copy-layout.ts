import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import TeamManager from '../../services/team-manager';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };

export default class TeamsCopyLayoutCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private inquirer: { prompt: (questions: unknown[]) => Promise<Record<string, unknown>> };

  static override description = "Copy a team's whole layout onto another team of the same project.";

  static override flags = {
    from: Flags.string({
      char: 'f',
      description: 'Name of the team to copy the layout from.',
      required: true,
    }),
    to: Flags.string({
      char: 't',
      description: 'Name of the team to copy the layout to (its layout is overwritten).',
      required: true,
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
    force: Flags.boolean({
      description: 'Skip the confirmation prompt.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  // Surface a server error's `errors[0].detail` cleanly (exit 1), letting
  // 401/403 flow to the base command's auth handler. Mirrors teams:create/delete.
  private surfaceApiError(error: unknown): never {
    const { response, status } = error as {
      status?: number;
      response?: { text?: string };
    };
    if (response && status !== 401 && status !== 403 && response.text) {
      let detail;
      try {
        detail = JSON.parse(response.text)?.errors?.[0]?.detail;
      } catch {
        // Non-JSON error body: fall through and rethrow the original error.
      }
      if (detail) {
        this.logger.error(detail);
        return this.exit(1);
      }
    }
    throw error;
  }

  private resolveTeam(teams: NamedEntity[], name: string, label: string): NamedEntity {
    const match = teams.find(t => t.name === name);
    if (match) return match;
    const available = teams.map(t => t.name).join(', ') || '(none)';
    this.logger.error(
      `${label} team "${name}" not found in this project. Available: ${available}.`,
    );
    return this.exit(1);
  }

  async runAuthenticated() {
    const oclifExit = this.exit.bind(this);
    const { flags } = await this.parse(TeamsCopyLayoutCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });
    const teamManager = new TeamManager(config);

    const teams: NamedEntity[] = await teamManager.listForProject();
    const fromTeam = this.resolveTeam(teams, flags.from, 'Source');
    const toTeam = this.resolveTeam(teams, flags.to, 'Target');

    if (fromTeam.id === toTeam.id) {
      this.logger.error('Source and target teams must be different.');
      this.exit(1);
      return;
    }

    if (!flags.force) {
      const { confirm } = await this.inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `This will overwrite the whole layout of team ${this.chalk.red(
            toTeam.name,
          )} with the layout of ${this.chalk.red(fromTeam.name)}. Continue?`,
          default: false,
        },
      ]);

      if (!confirm) {
        this.logger.info('Aborted.');
        return;
      }
    }

    let copied;
    try {
      copied = await teamManager.copyLayout(fromTeam.id, toTeam.id, oclifExit);
    } catch (error) {
      this.surfaceApiError(error);
    }

    if (copied) {
      this.logger.info(
        `Layout of team "${fromTeam.name}" copied to "${toTeam.name}" on project ${config.projectId}.`,
      );
    } else {
      this.logger.error('Oops, something went wrong.');
      this.exit(1);
    }
  }
}
