import type { ConfigInterface } from '../../interfaces/project-create-interface';

import toValidPackageName from '../../utils/to-valid-package-name';
import AbstractDumper from './abstract-dumper';

export default class AgentNodeJsDumper extends AbstractDumper {
  private env: any;

  private readonly DEFAULT_PORT = 3310;

  private readonly isLinuxOs: any;

  constructor(context) {
    const { assertPresent, env, isLinuxOs } = context;

    assertPresent({
      env,
      isLinuxOs,
    });

    super(context);

    this.env = env;
    this.isLinuxOs = isLinuxOs;
  }

  // eslint-disable-next-line class-methods-use-this
  get templateFolder() {
    return 'agent-nodejs/';
  }

  writePackageJson(dbDialect: string, applicationName: string) {
    const dependencies: any = {
      nodenv: '^16.0.1',
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
      } else if (dbDialect === 'mysql') {
        dependencies.mysql2 = '~2.2.5';
      } else if (dbDialect === 'mssql') {
        dependencies.tedious = '^6.4.0';
      }
    }

    const pkg = {
      name: toValidPackageName(applicationName),
      version: '0.0.1',
      private: true,
      scripts: { start: 'node ./index.js' },
      dependencies,
    };

    this.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  writeIndex(dbDialect) {
    const context = {
      forestUrl: !!this.env.FOREST_URL,
      datasourceImport: null,
      datasourceCreation: null,
    };

    if (dbDialect === 'mongodb') {
      context.datasourceImport = `const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');\nconst models = require('./models');`;
      context.datasourceCreation = 'createMongooseDataSource(models.connections.default, {}), {});';
    } else {
      context.datasourceImport = `const { createSqlDataSource } = require('@forestadmin/datasource-sql');`;
      context.datasourceCreation = 'createSqlDataSource(process.env.DATABASE_URL)';
    }

    this.copyHandleBarsTemplate('index.hbs', 'index.js', context);
  }

  private writeDotEnv(dbConfig, applicationPort, forestEnvSecret, forestAuthSecret) {
    const databaseUrl = this.buildDatabaseUrl(dbConfig);
    const context = {
      databaseUrl,
      ssl: dbConfig.ssl || false,
      dbSchema: dbConfig.dbSchema,
      port: applicationPort,
      forestUrl: this.env.FOREST_URL,
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

  createFiles(dumpConfig: ConfigInterface) {
    this.writePackageJson(dumpConfig.dbConfig.dbDialect, dumpConfig.appConfig.applicationName);
    this.writeIndex(dumpConfig.dbConfig.dbDialect);
    this.writeDotEnv(
      dumpConfig.dbConfig,
      dumpConfig.appConfig.appPort || this.DEFAULT_PORT,
      dumpConfig.forestEnvSecret,
      dumpConfig.forestAuthSecret,
    );
    this.writeGitignore();
  }
}
