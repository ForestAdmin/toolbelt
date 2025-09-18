import type { Config, DbConfig } from '../../interfaces/project-create-interface';
import type { Language } from '../../utils/languages';
import type Strings from '../../utils/strings';
import type Lodash from 'lodash';

import languages from '../../utils/languages';
import AbstractDumper from './abstract-dumper';

interface ModelConfiguration {
  collectionName: string;
  modelName: string;
  modelFileName: string;
  timestamps: boolean;
  fields: Array<object>;
  modelPath: string;
}

export default class AgentNodeJs extends AbstractDumper {
  private env: { FOREST_SERVER_URL: string; FOREST_URL_IS_DEFAULT: boolean };

  private readonly DEFAULT_PORT = 3310;

  private readonly isLinuxOs: boolean;

  private readonly isDatabaseLocal: (dbConfig: DbConfig) => boolean;

  private readonly buildDatabaseUrl: (dbConfig: DbConfig) => string;

  private readonly lodash: typeof Lodash;

  private readonly strings: Strings;

  private readonly toValidPackageName: (string: string) => string;

  protected readonly templateFolder = 'agent-nodejs';

  constructor(context) {
    const {
      assertPresent,
      env,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      lodash,
      strings,
      toValidPackageName,
      logger,
    } = context;

    assertPresent({
      env,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      lodash,
      strings,
      toValidPackageName,
      logger,
    });

    super(context);

    this.env = env;
    this.isLinuxOs = isLinuxOs;
    this.buildDatabaseUrl = buildDatabaseUrl;
    this.isDatabaseLocal = isDatabaseLocal;
    this.lodash = lodash;
    this.strings = strings;
    this.toValidPackageName = toValidPackageName;
  }

  writePackageJson(language: Language, dbDialect: string, appName: string) {
    const dependencies: { [name: string]: string } = {
      dotenv: '^16.0.1',
      '@forestadmin/agent': '^1.0.0',
    };

    if (dbDialect === 'mongodb') {
      dependencies['@forestadmin/datasource-mongo'] = '^1.0.0';
    } else {
      dependencies['@forestadmin/datasource-sql'] = '^1.0.0';
    }

    if (dbDialect) {
      if (dbDialect.includes('postgres')) {
        dependencies.pg = '^8.8.0';
      } else if (dbDialect === 'mysql') {
        dependencies.mysql2 = '^3.0.1';
      } else if (dbDialect === 'mariadb') {
        dependencies.mariadb = '^3.0.2';
      } else if (dbDialect === 'mssql') {
        dependencies.tedious = '^18.6.1';
      }
    }

    let scripts: { [name: string]: string } = {
      start: 'node ./index.js',
      'start:watch': 'nodemon ./index.js',
    };
    const devDependencies: { [name: string]: string } = {
      nodemon: '^2.0.12',
    };
    const nodemonConfig = {
      ignore: ['./forestadmin-schema.json'],
    };

    if (language === languages.Typescript) {
      scripts = {
        build: 'tsc',
        start: 'node ./dist/index.js',
        'start:watch': 'nodemon ./index.ts',
      };
      devDependencies.typescript = '^4.9.4';
      devDependencies['ts-node'] = '^10.9.1';
      nodemonConfig.ignore.push('./typings.ts');
    }

    const pkg = {
      name: this.toValidPackageName(appName),
      version: '0.0.1',
      private: true,
      scripts,
      nodemonConfig,
      dependencies,
      devDependencies,
    };

    this.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  writeTsConfigJson() {
    this.writeFile(
      'tsconfig.json',
      `${JSON.stringify(
        {
          compilerOptions: {
            experimentalDecorators: true,
            target: 'ES2020',
            module: 'CommonJS',
            moduleResolution: 'Node',
            esModuleInterop: true,
            declaration: true,
            declarationMap: true,
            inlineSourceMap: true,
            noImplicitOverride: true,
            stripInternal: true,
            outDir: 'dist',
            skipLibCheck: true,
          },
          'ts-node': {
            transpileOnly: true,
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  writeIndex(language: Language, dbDialect: string, dbSchema: string) {
    const isMongo = dbDialect === 'mongodb';

    const context = {
      isMongo,
      isMySQL: dbDialect === 'mysql',
      isMSSQL: dbDialect === 'mssql',
      isMariaDB: dbDialect === 'mariadb',
      dbSchema,
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
    };

    this.copyHandleBarsTemplate(
      `${language.name}/index.hbs`,
      `index.${language.fileExtension}`,
      context,
    );
  }

  private writeDotEnv(
    dbConfig: DbConfig,
    appPort: number,
    forestEnvSecret: string,
    forestAuthSecret: string,
  ) {
    const dbUrl = this.buildDatabaseUrl(dbConfig);
    const context = {
      isMongo: dbConfig.dbDialect === 'mongodb',
      dbUrl,
      dbSchema: dbConfig.dbSchema,
      dbSslMode: dbConfig.dbSslMode ?? 'disabled',
      appPort,
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
      forestEnvSecret,
      forestAuthSecret,
      hasDockerDbUrl: false,
      dockerDbUrl: '',
    };

    if (!this.isLinuxOs) {
      context.hasDockerDbUrl = true;
      context.dockerDbUrl = dbUrl.replace('localhost', 'host.docker.internal');
    }

    this.copyHandleBarsTemplate('common/env.hbs', '.env', context);
  }

  private writeGitignore(language: Language) {
    this.writeFile(
      '.gitignore',
      `node_modules\n.env\n${language === languages.Typescript ? 'dist\n' : ''}`,
    );
  }

  private writeTypings() {
    this.writeFile('typings.ts', '/* eslint-disable */\nexport type Schema = any;\n');
  }

  private writeDockerignore(language: Language) {
    this.writeFile(
      '.dockerignore',
      `node_modules\nnpm-debug.log\n.env\n${language === languages.Typescript ? 'dist\n' : ''}`,
    );
  }

  private writeDockerfile(language: Language) {
    this.copyHandleBarsTemplate(`${language.name}/Dockerfile.hbs`, 'Dockerfile');
  }

  private writeDockerCompose(config: Config) {
    const forestServerUrl = this.env.FOREST_URL_IS_DEFAULT ? false : `\${FOREST_SERVER_URL}`;

    let forestExtraHost = '';
    if (forestServerUrl) {
      try {
        forestExtraHost = new URL(this.env.FOREST_SERVER_URL).hostname;
      } catch (error) {
        throw new Error(`Invalid value for FOREST_SERVER_URL: "${this.env.FOREST_SERVER_URL}"`);
      }
    }

    this.copyHandleBarsTemplate(
      `${config.language.name}/docker-compose.hbs`,
      'docker-compose.yml',
      {
        containerName: this.lodash.snakeCase(config.appConfig.appName),
        forestExtraHost,
        isLinuxOs: this.isLinuxOs,
        network: this.isLinuxOs && this.isDatabaseLocal(config.dbConfig) ? 'host' : null,
      },
    );
  }

  protected async createFiles(dumpConfig: Config) {
    this.writePackageJson(
      dumpConfig.language,
      dumpConfig.dbConfig.dbDialect,
      dumpConfig.appConfig.appName,
    );
    if (dumpConfig.language === languages.Typescript) {
      this.writeTsConfigJson();
    }
    this.writeIndex(
      dumpConfig.language,
      dumpConfig.dbConfig.dbDialect,
      dumpConfig.dbConfig.dbSchema,
    );
    this.writeDotEnv(
      dumpConfig.dbConfig,
      dumpConfig.appConfig.appPort || this.DEFAULT_PORT,
      dumpConfig.forestEnvSecret,
      dumpConfig.forestAuthSecret,
    );
    this.writeTypings();
    this.writeGitignore(dumpConfig.language);
    this.writeDockerignore(dumpConfig.language);
    this.writeDockerfile(dumpConfig.language);
    this.writeDockerCompose(dumpConfig);
  }
}
