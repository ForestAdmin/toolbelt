import type { ConfigInterface, DbConfigInterface } from '../../interfaces/project-create-interface';

import toValidPackageName from '../../utils/to-valid-package-name';
import AbstractDumper from './abstract-dumper';

export default class AgentNodeJs extends AbstractDumper {
  private env: { FOREST_SERVER_URL: string; FOREST_URL_IS_DEFAULT: string };

  private readonly DEFAULT_PORT = 3310;

  private readonly isLinuxOs: boolean;

  private readonly isDatabaseLocal: (dbConfig: DbConfigInterface) => boolean;

  private readonly buildDatabaseUrl: (dbConfig: DbConfigInterface) => string;

  private readonly snakeCase: (string: string) => string;

  constructor(context) {
    const { assertPresent, env, isLinuxOs, buildDatabaseUrl, isDatabaseLocal, snakeCase } = context;

    assertPresent({
      env,
      isLinuxOs,
      isDatabaseLocal,
      snakeCase,
    });

    super(context);

    this.env = env;
    this.isLinuxOs = isLinuxOs;
    this.buildDatabaseUrl = buildDatabaseUrl;
    this.isDatabaseLocal = isDatabaseLocal;
    this.snakeCase = snakeCase;
  }

  // eslint-disable-next-line class-methods-use-this
  protected get templateFolder() {
    return 'agent-nodejs';
  }

  writePackageJson(dbDialect: string, applicationName: string) {
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
        dependencies.pg = '~8.2.2';
        dependencies['pg-hstore'] = '~2.3.4';
      } else if (dbDialect === 'mysql') {
        dependencies.mysql2 = '~2.2.5';
      } else if (dbDialect === 'mariadb') {
        dependencies.mariadb = '^2.3.3';
      } else if (dbDialect === 'mssql') {
        dependencies.tedious = '^6.4.0';
      }
    }

    const pkg = {
      name: toValidPackageName(applicationName),
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

  writeIndex(dbDialect: string) {
    const isMongoose = dbDialect === 'mongodb';

    const context = {
      isMongoose,
      isMySQL: dbDialect === 'mysql',
      isMSSQL: dbDialect === 'mssql',
      isMariaDB: dbDialect === 'mariadb',
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
      datasourceCreation: isMongoose
        ? 'createMongooseDataSource(connection, {})'
        : `
    createSqlDataSource({
      uri: process.env.DATABASE_URL,
      schema: process.env.DATABASE_SCHEMA || 'public',
      ...dialectOptions,
    }),
  `,
      datasourceImport: isMongoose
        ? `const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');\nconst connection = require('./mongoose-models');`
        : `const { createSqlDataSource } = require('@forestadmin/datasource-sql');`,
    };

    this.copyHandleBarsTemplate('index.hbs', 'index.js', context);
  }

  private writeDotEnv(
    dbConfig: DbConfigInterface,
    applicationPort: number,
    forestEnvSecret: string,
    forestAuthSecret: string,
  ) {
    const databaseUrl = this.buildDatabaseUrl(dbConfig);
    const context = {
      databaseUrl,
      databaseSsl: dbConfig.ssl || false,
      databaseSchema: dbConfig.dbSchema !== '' ? dbConfig.dbSchema : false,
      applicationPort,
      forestServerUrl: this.env.FOREST_URL_IS_DEFAULT ? false : this.env.FOREST_SERVER_URL,
      forestEnvSecret,
      forestAuthSecret,
      hasDockerDatabaseUrl: false,
      dockerDatabaseUrl: undefined,
    };
    if (!this.isLinuxOs) {
      context.dockerDatabaseUrl = databaseUrl.replace('localhost', 'host.docker.internal');
      context.hasDockerDatabaseUrl = true;
    }
    this.copyHandleBarsTemplate('env.hbs', '.env', context);
  }

  private writeGitignore() {
    this.writeFile('.gitignore', 'node_modules\n.env');
  }

  private writeTypings() {
    this.writeFile('typings.ts', '/* eslint-disable */\nexport type Schema = any;');
  }

  private writeDockerignore() {
    this.writeFile('.dockerignore', 'node_modules\nnpm-debug.log\n.env');
  }

  private writeDockerfile() {
    this.copyHandleBarsTemplate('Dockerfile.hbs', 'Dockerfile');
  }

  private writeDockerCompose(config: ConfigInterface) {
    const databaseUrl = `\${${this.isLinuxOs ? 'DATABASE_URL' : 'DOCKER_DATABASE_URL'}}`;
    const forestServerUrl = this.env.FOREST_URL_IS_DEFAULT ? false : `\${FOREST_SERVER_URL}`;

    let forestExtraHost: string | boolean = false;
    if (forestServerUrl) {
      try {
        const parsedForestUrl = new URL(this.env.FOREST_SERVER_URL);
        forestExtraHost = parsedForestUrl.hostname;
      } catch (error) {
        throw new Error(`Invalid value for FOREST_SERVER_URL: "${this.env.FOREST_SERVER_URL}"`);
      }
    }

    this.copyHandleBarsTemplate('docker-compose.hbs', 'docker-compose.yml', {
      containerName: this.snakeCase(config.appConfig.applicationName),
      databaseUrl,
      dbSchema: config.dbConfig.dbSchema !== '' ? config.dbConfig.dbSchema : false,
      forestExtraHost,
      forestServerUrl,
      network: this.isLinuxOs && this.isDatabaseLocal(config.dbConfig) ? 'host' : null,
    });
  }

  protected createFiles(dumpConfig: ConfigInterface) {
    this.writePackageJson(dumpConfig.dbConfig.dbDialect, dumpConfig.appConfig.applicationName);
    this.writeIndex(dumpConfig.dbConfig.dbDialect);
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
