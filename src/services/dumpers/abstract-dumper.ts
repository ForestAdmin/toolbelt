import type { Config } from '../../interfaces/project-create-interface';
import type Logger from '../logger';
import type { Chalk } from 'chalk';

import '../../utils/handlebars/loader';

export default abstract class AbstractDumper {
  protected projectPath: string;

  protected readonly mkdirp;

  private readonly fs;

  private readonly logger: Logger;

  private readonly chalk: Chalk;

  private readonly constants: { [name: string]: string };

  private readonly Handlebars;

  protected constructor({ assertPresent, fs, logger, chalk, constants, mkdirp, Handlebars }) {
    assertPresent({
      fs,
      logger,
      chalk,
      constants,
      mkdirp,
      Handlebars,
    });

    this.fs = fs;
    this.logger = logger;
    this.chalk = chalk;
    this.constants = constants;
    this.mkdirp = mkdirp;
    this.Handlebars = Handlebars;
  }

  protected abstract get templateFolder(): string;

  protected abstract createFiles(dumperConfig: Config, schema?: any);

  protected writeFile(relativeFilePath, content) {
    const fileName = `${this.projectPath}/${relativeFilePath}`;

    if (this.fs.existsSync(fileName)) {
      this.logger.log(`  ${this.chalk.yellow('skip')} ${relativeFilePath} - already exists.`);
      return;
    }

    this.fs.writeFileSync(fileName, content);
    this.logger.log(`  ${this.chalk.green('create')} ${relativeFilePath}`);
  }

  protected copyHandleBarsTemplate(
    source: string,
    target: string,
    context?: Record<string, unknown>,
  ) {
    const templatePath = `${__dirname}/templates/${this.templateFolder}/${source}`;

    if (context && Object.keys(context).length > 0) {
      const handlebarsTemplate = () =>
        this.Handlebars.compile(this.fs.readFileSync(templatePath, 'utf-8'), { noEscape: true });

      return this.writeFile(target, handlebarsTemplate()(context));
    }

    return this.writeFile(target, this.fs.readFileSync(templatePath, 'utf-8'));
  }

  async dump(dumperConfig: Config, schema?: any) {
    const cwd = this.constants.CURRENT_WORKING_DIRECTORY;
    this.projectPath = dumperConfig.appConfig.appName
      ? `${cwd}/${dumperConfig.appConfig.appName}`
      : cwd;

    await this.mkdirp(this.projectPath);

    await this.createFiles(dumperConfig, schema);
  }
}
