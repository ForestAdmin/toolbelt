import type ProjectRenderer from '../../renderers/project';
import type * as Config from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import ProjectManager from '../../services/project-manager';

export default class GetCommand extends AbstractAuthenticatedCommand {
  private env: { FOREST_URL: string };

  private projectRenderer: ProjectRenderer;

  static override flags = {
    format: flags.string({
      char: 'f',
      description: 'Ouput format.',
      options: ['table', 'json'],
      default: 'table',
    }),
  };

  static override args = [
    {
      name: 'projectId',
      required: true,
      description: 'ID of a project.',
    },
  ];

  static override description = 'Get the configuration of a project.';

  constructor(argv: string[], config: Config.IConfig, plan?) {
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
    const parsed = this.parse(GetCommand);

    const config = { ...this.env, ...parsed.flags, ...(parsed.args as { projectId: string }) };

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject();
      this.projectRenderer.render(project, config);
    } catch (err) {
      this.logger.error(`Cannot find the project ${this.chalk.bold(config.projectId)}.`);
    }
  }
}
