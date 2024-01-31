import type ProjectRenderer from '../../renderers/project';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import ProjectManager from '../../services/project-manager';

export default class GetCommand extends AbstractAuthenticatedCommand {
  private env: { FOREST_SERVER_URL: string };

  private projectRenderer: ProjectRenderer;

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Ouput format.',
      options: ['table', 'json'],
      default: 'table',
    }),
  };

  static override args = {
    projectId: Args.integer({
      name: 'projectId',
      required: true,
      description: 'ID of a project.',
    }),
  };

  static override description = 'Get the configuration of a project.';

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);

    const { assertPresent, env, projectRenderer } = this.context;
    assertPresent({
      env,
      projectRenderer,
    });

    this.env = env;
    this.projectRenderer = projectRenderer;
  }

  async runAuthenticated() {
    const parsed = await this.parse(GetCommand);

    const config = { ...this.env, ...(await parsed).flags, ...(await parsed).args };

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject();
      this.projectRenderer.render(project, config);
    } catch (err) {
      this.logger.error(`Cannot find the project ${this.chalk.bold(config.projectId)}.`);
    }
  }
}
