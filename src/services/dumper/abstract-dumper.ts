import type { ConfigInterface } from '../../interfaces/project-create-interface';

export default abstract class AbstractDumper {
  private readonly fs;

  private readonly logger;

  private readonly chalk;

  protected projectPath: string;

  private readonly constants: any;

  protected readonly mkdirp: any;

  private readonly defaultPort = 3310;

  private readonly Handlebars: any;

  protected port;

  protected readonly buildDatabaseUrl: any;

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

  writeFile(relativeFilePath, content) {
    const fileName = `${this.projectPath}/${relativeFilePath}`;

    if (this.fs.existsSync(fileName)) {
      this.logger.log(`  ${this.chalk.yellow('skip')} ${relativeFilePath} - already exists.`);
      return;
    }

    this.fs.writeFileSync(fileName, content);
    this.logger.log(`  ${this.chalk.green('create')} ${relativeFilePath}`);
  }

  private copyTemplate(source: string, target: string) {
    this.writeFile(target, this.fs.readFileSync(source, 'utf-8'));
  }

  copyHandleBarsTemplate(source: string, target: string, context?: Record<string, unknown>) {
    const templatePath = `${__dirname}/templates/${this.templateFolder}${source}`;

    if (context && Object.keys(context).length > 0) {
      const handlebarsTemplate = () =>
        this.Handlebars.compile(this.fs.readFileSync(templatePath, 'utf-8'), { noEscape: true });

      return this.writeFile(target, handlebarsTemplate()(context));
    }

    return this.copyTemplate(templatePath, target);
  }

  abstract createFiles(dumperConfig: ConfigInterface, schema: any);

  abstract get templateFolder();

  async dump(dumperConfig: ConfigInterface, schema?: any) {
    const cwd = dumperConfig.appConfig.path || this.constants.CURRENT_WORKING_DIRECTORY;
    this.projectPath = dumperConfig.appConfig.applicationName
      ? `${cwd}/${dumperConfig.appConfig.applicationName}`
      : cwd;

    this.port = dumperConfig.appConfig.appPort || this.defaultPort;

    await this.mkdirp(this.projectPath);

    await this.createFiles(dumperConfig, schema);
  }
}
