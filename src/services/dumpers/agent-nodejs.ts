import type { Config, DbConfig } from '../../interfaces/project-create-interface';
import type { Language } from '../../utils/languages';
import type Strings from '../../utils/strings';
import type Lodash from 'lodash';

import AbstractDumper from './abstract-dumper';

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
    } = context;

    assertPresent({
      env,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      lodash,
      strings,
      toValidPackageName,
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

  writePackageJson(language: Languages, dbDialect: string, appName: string) {
    const dependencies: { [name: string]: string } = {
      dotenv: '^16.0.1',
      '@forestadmin/agent': '^1.0.0',
    };

    if (dbDialect === 'mongodb') {
      dependencies['@forestadmin/datasource-mongoose'] = '^1.0.0';
      dependencies.mongoose = '^6.10.3';
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
        dependencies.tedious = '^15.1.2';
      }
    }

    const scripts: { [name: string]: string } = {
      start: 'nodemon ./index.js',
      'start:agent': 'node ./index.js',
    };
    const devDependencies: { [name: string]: string } = {
      nodemon: '^2.0.12',
    };

    if (language === languages.Typescript) {
      scripts = {
        build: 'tsc',
        'build:watch': 'tsc --watch',
        clean: 'rm -rf dist',
        start:
          'node --enable-source-maps --async-stack-traces -e "require(\'./dist/index.js\').default()"',
        'start:watch': "nodemon --delay 250ms --watch '../*/dist/' --exec yarn start",
      };
      devDependencies.typescript = '^4.9.4';
    }

    const pkg = {
      name: this.toValidPackageName(appName),
      version: '0.0.1',
      private: true,
      scripts,
      nodemonConfig: {
        ignore: ['./forestadmin-schema.json'],
      },
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
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  writeIndex(language: Language, dbDialect: string, dbSchema: string) {
    const isMongoose = dbDialect === 'mongodb';

    const context = {
      isMongoose,
      isMySQL: dbDialect === 'mysql',
      isMSSQL: dbDialect === 'mssql',
      isMariaDB: dbDialect === 'mariadb',
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
      datasourceImport: null,
      datasourceCreation: null,
    };

    if (isMongoose) {
      context.datasourceImport = `const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');\nconst connection = require('./models');`;
      context.datasourceCreation = `createMongooseDataSource(connection, { flattenMode: 'auto' })`;
    } else {
      context.datasourceImport = `const { createSqlDataSource } = require('@forestadmin/datasource-sql');`;
      context.datasourceCreation = `
    createSqlDataSource({
      uri: process.env.DATABASE_URL,${
        dbSchema ? '\n      schema: process.env.DATABASE_SCHEMA,' : ''
      }
      dialectOptions,
    }),
  `;
    }

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
      dbUrl,
      dbSsl: dbConfig.dbSsl || false,
      dbSchema: dbConfig.dbSchema,
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

  private writeGitignore() {
    this.writeFile('.gitignore', 'node_modules\n.env\n');
  }

  private writeTypings() {
    this.writeFile('typings.ts', '/* eslint-disable */\nexport type Schema = any;\n');
  }

  private writeDockerignore() {
    this.writeFile('.dockerignore', 'node_modules\nnpm-debug.log\n.env\n');
  }

  private writeDockerfile() {
    this.copyHandleBarsTemplate('common/Dockerfile.hbs', 'Dockerfile');
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

    this.copyHandleBarsTemplate('common/docker-compose.hbs', 'docker-compose.yml', {
      containerName: this.lodash.snakeCase(config.appConfig.appName),
      forestExtraHost,
      isLinuxOs: this.isLinuxOs,
      network: this.isLinuxOs && this.isDatabaseLocal(config.dbConfig) ? 'host' : null,
    });
  }

  private async writeMongooseModels(language: Language, schema) {
    await this.mkdirp(`${this.projectPath}/models`);

    this.copyHandleBarsTemplate(
      `${language.name}/models/index.hbs`,
      `models/index.${language.fileExtension}`,
    );

    const collectionNamesSorted = Object.keys(schema).sort();

    collectionNamesSorted.forEach(collectionName => {
      const { fields, options } = schema[collectionName];
      const modelPath = `models/${this.lodash.kebabCase(collectionName)}.${language.fileExtension}`;

      const fieldsDefinition = fields.map(field => {
        return {
          ...field,
          ref: field.ref && this.strings.transformToCamelCaseSafeString(field.ref),
        };
      });

      this.copyHandleBarsTemplate(`${language.name}/models/model.hbs`, modelPath, {
        modelName: this.strings.transformToCamelCaseSafeString(collectionName),
        collectionName,
        fields: fieldsDefinition,
        timestamps: options.timestamps,
      });
    });
  }

  protected async createFiles(dumpConfig: Config, mongoSchema?: any) {
    this.writePackageJson(
      dumpConfig.language,
      dumpConfig.dbConfig.dbDialect,
      dumpConfig.appConfig.appName,
    );
    if (dumpConfig.language === Languages.Typescript) {
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
    this.writeGitignore();
    this.writeDockerignore();
    this.writeDockerfile();
    this.writeDockerCompose(dumpConfig);

    if (dumpConfig.dbConfig.dbDialect === 'mongodb' && mongoSchema) {
      await this.writeMongooseModels(dumpConfig.language, mongoSchema);
    }
  }
}
