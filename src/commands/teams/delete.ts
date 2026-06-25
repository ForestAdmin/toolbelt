import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import TeamManager from '../../services/team-manager';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };

export default class TeamsDeleteCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private inquirer: { prompt: (questions: unknown[]) => Promise<Record<string, unknown>> };

  static override description = 'Delete a team from a project.';

  static override flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name of the team to delete.',
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

  async runAuthenticated() {
    const { flags } = await this.parse(TeamsDeleteCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });
    const teamManager = new TeamManager(config);

    const teams: NamedEntity[] = await teamManager.listForProject();
    const team = teams.find(t => t.name === flags.name);
    if (!team) {
      const available = teams.map(t => t.name).join(', ') || '(none)';
      this.logger.error(`Team "${flags.name}" not found in this project. Available: ${available}.`);
      this.exit(1);
      return;
    }

    if (!flags.force) {
      const { confirm } = await this.inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `This will permanently delete team ${this.chalk.red(team.name)} on project ${
            config.projectId
          }. Continue?`,
          default: false,
        },
      ]);

      if (!confirm) {
        this.logger.info('Aborted.');
        return;
      }
    }

    try {
      await teamManager.deleteTeam(team.id);
      this.logger.info(`Team "${team.name}" deleted from project ${config.projectId}.`);
    } catch (error) {
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
          this.exit(1);
          return;
        }
      }
      throw error;
    }
  }
}
