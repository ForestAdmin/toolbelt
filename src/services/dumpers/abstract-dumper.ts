import type { ConfigInterface } from '../../interfaces/project-create-interface';
import '../../utils/handlebars/loader';

export default abstract class AbstractDumper {
  protected projectPath: string;

  protected readonly buildDatabaseUrl;

  protected readonly mkdirp;

  private readonly fs;

  private readonly logger;

  private readonly chalk;

  private readonly constants;

  private readonly Handlebars;

  protected constructor({
    assertPresent,
    fs,
    logger,
    chalk,
    constants,
    mkdirp,
    Handlebars,
    buildDatabaseUrl,
  }) {
    assertPresent({
      fs,
      logger,
      chalk,
      constants,
      mkdirp,
      Handlebars,
      buildDatabaseUrl,
    });

    this.fs = fs;
    this.logger = logger;
    this.chalk = chalk;
    this.constants = constants;
    this.mkdirp = mkdirp;
    this.Handlebars = Handlebars;
    this.buildDatabaseUrl = buildDatabaseUrl;
  }

  protected abstract get templateFolder();

  protected abstract createFiles(dumperConfig: ConfigInterface, schema: any);

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

  async dump(dumperConfig: ConfigInterface, schema?: any) {
    const cwd = this.constants.CURRENT_WORKING_DIRECTORY;
    this.projectPath = dumperConfig.appConfig.applicationName
      ? `${cwd}/${dumperConfig.appConfig.applicationName}`
      : cwd;

    await this.mkdirp(this.projectPath);

    await this.createFiles(dumperConfig, schema);
  }
}
