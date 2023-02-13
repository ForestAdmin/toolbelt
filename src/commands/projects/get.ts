import { flags } from '@oclif/command';
import ProjectManager from '../../services/project-manager';
import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';

export default class GetCommand extends AbstractAuthenticatedCommand {
  private env: any;

  private projectRenderer: any;

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

  constructor(argv, config, plan) {
    super(argv, config, plan);

    const { assertPresent, chalk, env, projectRenderer } = this.context;
    assertPresent({
      chalk,
      env,
      projectRenderer,
    });
    this.chalk = chalk;
    this.env = env;
    this.projectRenderer = projectRenderer;
  }

  async run() {
    await this.checkAuthentication();
    const parsed = this.parse(GetCommand);

    const config = { ...this.env, ...parsed.flags, ...parsed.args };

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject();
      this.projectRenderer.render(project, config);
    } catch (err) {
      this.logger.error(`Cannot find the project ${this.chalk.bold(config.projectId)}.`);
    }
  }

  override async catch(error) {
    await this.handleAuthenticationErrors(error);
    return super.catch(error);
  }
}
