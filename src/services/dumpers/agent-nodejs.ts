import type { Config, DbConfig } from '../../interfaces/project-create-interface';
import type Lodash from 'lodash';

import AbstractDumper from './abstract-dumper';

export default class AgentNodeJs extends AbstractDumper {
  private env: { FOREST_SERVER_URL: string; FOREST_URL_IS_DEFAULT: boolean };

  private readonly DEFAULT_PORT = 3310;

  private readonly isLinuxOs: boolean;

  private readonly isDatabaseLocal: (dbConfig: DbConfig) => boolean;

  private readonly buildDatabaseUrl: (dbConfig: DbConfig) => string;

  private readonly lodash: typeof Lodash;

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
      toValidPackageName,
    } = context;

    assertPresent({
      env,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      lodash,
      toValidPackageName,
    });

    super(context);

    this.env = env;
    this.isLinuxOs = isLinuxOs;
    this.buildDatabaseUrl = buildDatabaseUrl;
    this.isDatabaseLocal = isDatabaseLocal;
    this.lodash = lodash;
    this.toValidPackageName = toValidPackageName;
  }

  writePackageJson(dbDialect: string, appName: string) {
    const dependencies: { [name: string]: string } = {
      dotenv: '^16.0.1',
      '@forestadmin/agent': '^1.0.0',
    };

    if (dbDialect === 'mongodb') {
      dependencies['@forestadmin/datasource-mongoose'] = '^1.0.0';
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

    const pkg = {
      name: this.toValidPackageName(appName),
      version: '0.0.1',
      private: true,
      main: 'index.js',
      scripts: {
        'start:watch': 'nodemon',
        start: 'node ./index.js',
      },
      nodemonConfig: {
        ignore: ['./forestadmin-schema.json'],
      },
      dependencies,
      devDependencies: {
        nodemon: '^2.0.12',
      },
    };

    this.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  writeIndex(dbDialect: string, dbSchema: string) {
    const isMongoose = dbDialect === 'mongodb';

    const context = {
      isMongoose,
      isMySQL: dbDialect === 'mysql',
      isMSSQL: dbDialect === 'mssql',
      isMariaDB: dbDialect === 'mariadb',
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
      datasourceImport: isMongoose
        ? `const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');\nconst connection = require('./mongoose-models');`
        : `const { createSqlDataSource } = require('@forestadmin/datasource-sql');`,
      datasourceCreation: isMongoose
        ? 'createMongooseDataSource(connection, {})'
        : `
    createSqlDataSource({
      uri: process.env.DATABASE_URL,${
        dbSchema ? '\n      schema: process.env.DATABASE_SCHEMA,' : ''
      }
      ...dialectOptions,
    }),
  `,
    };

    this.copyHandleBarsTemplate('index.hbs', 'index.js', context);
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

    this.copyHandleBarsTemplate('env.hbs', '.env', context);
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
    this.copyHandleBarsTemplate('Dockerfile.hbs', 'Dockerfile');
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

    this.copyHandleBarsTemplate('docker-compose.hbs', 'docker-compose.yml', {
      containerName: this.lodash.snakeCase(config.appConfig.appName),
      forestExtraHost,
      isLinuxOs: this.isLinuxOs,
      network: this.isLinuxOs && this.isDatabaseLocal(config.dbConfig) ? 'host' : null,
    });
  }

  protected createFiles(dumpConfig: Config) {
    this.writePackageJson(dumpConfig.dbConfig.dbDialect, dumpConfig.appConfig.appName);
    this.writeIndex(dumpConfig.dbConfig.dbDialect, dumpConfig.dbConfig.dbSchema);
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
  }
}