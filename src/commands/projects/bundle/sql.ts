import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import { optionsToFlags } from '../../../utils/option-parser';
import SqlCommand from '../create/sql';

export default class SqlBundleCommand extends SqlCommand {
  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  static override description = 'Bundle files for Forest Admin project.';

  protected override async runAuthenticated(): Promise<void> {
    const { appConfig, dbConfig, language } = await this.getConfig();

    await this.testDatabaseConnection(dbConfig);

    await this.generateProject({
      dbConfig,
      appConfig,
      forestAuthSecret: '<TO BE FILLED WITH FOREST INIT COMMAND RESULT>',
      forestEnvSecret: '<TO BE FILLED WITH FOREST INIT COMMAND RESULT>',
      language,
    });

    this.logger.info(`Hooray, ${this.chalk.green('installation success')}!`);
  }
}
