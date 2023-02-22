const _ = require('lodash');
const { URL } = require('url');
const { plural, singular } = require('pluralize');
const stringUtils = require('../../utils/strings');
const toValidPackageName = require('../../utils/to-valid-package-name');
const IncompatibleLianaForUpdateError = require('../../errors/dumper/incompatible-liana-for-update-error');
const InvalidForestCLIProjectStructureError = require('../../errors/dumper/invalid-forest-cli-project-structure-error');
require('./handlebars/loader');
const AbstractDumper = require('./abstract-dumper').default;

class Dumper extends AbstractDumper {
  constructor(context) {
    super(context);

    const { assertPresent, env, os, Sequelize, Handlebars, mkdirp } = context;

    assertPresent({
      env,
      os,
      Sequelize,
      Handlebars,
      mkdirp,
    });

    this.env = env;
    this.os = os;
    this.Sequelize = Sequelize;
    this.Handlebars = Handlebars;
    this.mkdirp = mkdirp;
  }

  static getModelsNameSorted(schema) {
    return Object.keys(schema).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  static getSafeReferences(references) {
    return references.map(reference => ({
      ...reference,
      ref: Dumper.getModelNameFromTableName(reference.ref),
    }));
  }

  // HACK: If a table name is "sessions" or "stats" the generated routes will conflict with
  //       Forest Admin internal route (session or stats creation).
  static shouldSkipRouteGenerationForModel(modelName) {
    return ['sessions', 'stats'].includes(modelName.toLowerCase());
  }

  // eslint-disable-next-line class-methods-use-this
  get templateFolder() {
    return 'agent-v1/';
  }

  isLinuxBasedOs() {
    return this.os.platform() === 'linux';
  }

  writePackageJson(dbDialect, applicationName) {
    const orm = dbDialect === 'mongodb' ? 'mongoose' : 'sequelize';
    const dependencies = {
      'body-parser': '1.19.0',
      chalk: '~1.1.3',
      'cookie-parser': '1.4.4',
      cors: '2.8.5',
      debug: '~4.0.1',
      dotenv: '~6.1.0',
      express: '~4.17.1',
      'express-jwt': '6.1.2',
      [`forest-express-${orm}`]: '^8.0.0',
      morgan: '1.9.1',
      'require-all': '^3.0.0',
      sequelize: '~5.15.1',
    };

    if (dbDialect) {
      if (dbDialect.includes('postgres')) {
        dependencies.pg = '~8.2.2';
      } else if (dbDialect === 'mysql') {
        dependencies.mysql2 = '~2.2.5';
      } else if (dbDialect === 'mssql') {
        dependencies.tedious = '^6.4.0';
      } else if (dbDialect === 'mongodb') {
        delete dependencies.sequelize;
        dependencies.mongoose = '~5.13.9';
      }
    }

    const pkg = {
      name: toValidPackageName(applicationName),
      version: '0.0.1',
      private: true,
      scripts: { start: 'node ./server.js' },
      dependencies,
    };

    this.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  static tableToFilename(table) {
    return _.kebabCase(table);
  }

  static getDatabaseUrl(dbConfig) {
    let connectionString;

    if (dbConfig.dbConnectionUrl) {
      connectionString = dbConfig.dbConnectionUrl;
    } else {
      let protocol = dbConfig.dbDialect;
      let port = `:${dbConfig.dbPort}`;
      let password = '';

      if (dbConfig.dbDialect === 'mongodb' && dbConfig.mongodbSrv) {
        protocol = 'mongodb+srv';
        port = '';
      }

      if (dbConfig.dbPassword) {
        // NOTICE: Encode password string in case of special chars.
        password = `:${encodeURIComponent(dbConfig.dbPassword)}`;
      }

      connectionString = `${protocol}://${dbConfig.dbUser}${password}@${dbConfig.dbHostname}${port}/${dbConfig.dbName}`;
    }

    return connectionString;
  }

  static isDatabaseLocal(dbConfig) {
    const databaseUrl = Dumper.getDatabaseUrl(dbConfig);
    return databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost');
  }

  static isLocalUrl(url) {
    return /^http:\/\/(?:localhost|127\.0\.0\.1)$/.test(url);
  }

  getApplicationUrl(appHostname) {
    const hostUrl = /^https?:\/\//.test(appHostname) ? appHostname : `http://${appHostname}`;

    return Dumper.isLocalUrl(hostUrl) ? `${hostUrl}:${this.port}` : hostUrl;
  }

  writeDotEnv(config) {
    console.log(this.port);
    const databaseUrl = Dumper.getDatabaseUrl(config.dbConfig);
    const context = {
      databaseUrl,
      ssl: config.dbConfig.ssl || 'false',
      dbSchema: config.dbConfig.dbSchema,
      hostname: config.appConfig.appHostname,
      port: this.port,
      forestEnvSecret: config.forestEnvSecret,
      forestAuthSecret: config.forestAuthSecret,
      hasDockerDatabaseUrl: false,
      applicationUrl: this.getApplicationUrl(config.appConfig.appHostname),
    };
    if (!this.isLinuxBasedOs()) {
      context.dockerDatabaseUrl = databaseUrl.replace('localhost', 'host.docker.internal');
      context.hasDockerDatabaseUrl = true;
    }
    this.copyHandleBarsTemplate('env.hbs', '.env', context);
  }

  static getModelNameFromTableName(table) {
    return stringUtils.transformToCamelCaseSafeString(table);
  }

  writeModel(config, table, fields, references, options = {}) {
    const { underscored } = options;
    let modelPath = `models/${Dumper.tableToFilename(table)}.js`;
    if (config.appConfig.useMultiDatabase) {
      modelPath = `models/${config.modelsExportPath}/${Dumper.tableToFilename(table)}.js`;
    }

    const fieldsDefinition = fields.map(field => {
      const expectedConventionalColumnName = underscored ? _.snakeCase(field.name) : field.name;
      // NOTICE: sequelize considers column name with parenthesis as raw Attributes
      // only set as unconventional name if underscored is true for adding special field attribute
      // and avoid sequelize issues
      const hasParenthesis =
        field.nameColumn && (field.nameColumn.includes('(') || field.nameColumn.includes(')'));
      const nameColumnUnconventional =
        field.nameColumn !== expectedConventionalColumnName ||
        (underscored && (/[1-9]/g.test(field.name) || hasParenthesis));

      return {
        ...field,
        ref: field.ref && Dumper.getModelNameFromTableName(field.ref),
        nameColumnUnconventional,
        hasParenthesis,

        // Only output default value when non-null
        hasSafeDefaultValue: !_.isNil(field.defaultValue),
        safeDefaultValue:
          field.defaultValue instanceof this.Sequelize.Utils.Literal
            ? `Sequelize.literal('${field.defaultValue.val.replace(/'/g, "\\'")}')`
            : JSON.stringify(field.defaultValue),
      };
    });

    const referencesDefinition = references.map(reference => ({
      ...reference,
      isBelongsToMany: reference.association === 'belongsToMany',
      targetKey: _.camelCase(reference.targetKey),
      sourceKey: _.camelCase(reference.sourceKey),
    }));

    this.copyHandleBarsTemplate(
      `models/${config.dbConfig.dbDialect === 'mongodb' ? 'mongo' : 'sequelize'}-model.hbs`,
      modelPath,
      {
        modelName: Dumper.getModelNameFromTableName(table),
        modelVariableName: stringUtils.pascalCase(stringUtils.transformToSafeString(table)),
        table,
        fields: fieldsDefinition,
        references: referencesDefinition,
        ...options,
        schema: config.dbConfig.dbSchema,
        dialect: config.dbConfig.dbDialect,
        noId: !options.hasIdColumn && !options.hasPrimaryKeys,
      },
    );
  }

  writeRoute(dbDialect, modelName) {
    const routesPath = `routes/${Dumper.tableToFilename(modelName)}.js`;

    const modelNameDasherized = _.kebabCase(modelName);
    const readableModelName = _.startCase(modelName);

    this.copyHandleBarsTemplate('routes/route.hbs', routesPath, {
      modelName: Dumper.getModelNameFromTableName(modelName),
      modelNameDasherized,
      modelNameReadablePlural: plural(readableModelName),
      modelNameReadableSingular: singular(readableModelName),
      isMongoDB: dbDialect === 'mongodb',
    });
  }

  writeForestCollection(config, table) {
    const collectionPath = `forest/${Dumper.tableToFilename(table)}.js`;

    this.copyHandleBarsTemplate('forest/collection.hbs', collectionPath, {
      isMongoDB: config.dbDialect === 'mongodb',
      table: Dumper.getModelNameFromTableName(table),
    });
  }

  writeAppJs(dbDialect) {
    this.copyHandleBarsTemplate('app.hbs', 'app.js', {
      isMongoDB: dbDialect === 'mongodb',
      forestUrl: this.env.FOREST_URL,
    });
  }

  writeModelsIndex(dbDialect) {
    this.copyHandleBarsTemplate('models/index.hbs', 'models/index.js', {
      isMongoDB: dbDialect === 'mongodb',
    });
  }

  writeDatabasesConfig(config) {
    const { dbDialect } = config;

    this.copyHandleBarsTemplate('config/databases.hbs', 'config/databases.js', {
      isMongoDB: dbDialect === 'mongodb',
      isMSSQL: dbDialect === 'mssql',
      isMySQL: dbDialect === 'mysql',
    });
  }

  writeDockerfile() {
    this.copyHandleBarsTemplate('Dockerfile.hbs', 'Dockerfile');
  }

  writeDockerCompose(config) {
    const databaseUrl = `\${${this.isLinuxBasedOs() ? 'DATABASE_URL' : 'DOCKER_DATABASE_URL'}}`;
    const forestUrl = this.env.FOREST_URL_IS_DEFAULT
      ? false
      : `\${FOREST_URL-${this.env.FOREST_URL}}`;
    let forestExtraHost = false;
    if (forestUrl) {
      try {
        const parsedForestUrl = new URL(this.env.FOREST_URL);
        forestExtraHost = parsedForestUrl.hostname;
      } catch (error) {
        throw new Error(`Invalid value for FOREST_URL: "${this.env.FOREST_URL}"`);
      }
    }
    this.copyHandleBarsTemplate('docker-compose.hbs', 'docker-compose.yml', {
      containerName: _.snakeCase(config.appConfig.applicationName),
      databaseUrl,
      dbSchema: config.dbConfig.dbSchema,
      forestExtraHost,
      forestUrl,
      network: this.isLinuxBasedOs() && Dumper.isDatabaseLocal(config.dbConfig) ? 'host' : null,
    });
  }

  writeForestAdminMiddleware(dbDialect) {
    this.copyHandleBarsTemplate('middlewares/forestadmin.hbs', 'middlewares/forestadmin.js', {
      isMongoDB: dbDialect === 'mongodb',
    });
  }

  // NOTICE: Generate files in alphabetical order to ensure a nice generation console logs display.
  async createFiles(config, schema) {
    const { isUpdate, useMultiDatabase, modelsExportPath } = config;

    await this.mkdirp(`${this.projectPath}/routes`);
    await this.mkdirp(`${this.projectPath}/forest`);
    await this.mkdirp(`${this.projectPath}/models`);

    if (useMultiDatabase) {
      await this.mkdirp(`${this.projectPath}/models/${modelsExportPath}`);
    }

    if (!isUpdate) {
      await this.mkdirp(`${this.projectPath}/config`);
      await this.mkdirp(`${this.projectPath}/public`);
      await this.mkdirp(`${this.projectPath}/views`);
      await this.mkdirp(`${this.projectPath}/middlewares`);
    }

    const modelNames = Dumper.getModelsNameSorted(schema);

    if (!isUpdate) this.writeDatabasesConfig(config);

    modelNames.forEach(modelName => this.writeForestCollection(config, modelName));

    if (!isUpdate) {
      this.writeForestAdminMiddleware(config.dbConfig.dbDialect);
      this.copyHandleBarsTemplate('middlewares/welcome.hbs', 'middlewares/welcome.js');
      this.writeModelsIndex(config.dbConfig.dbDialect);
    }

    modelNames.forEach(modelName => {
      const { fields, references, options } = schema[modelName];
      const safeReferences = Dumper.getSafeReferences(references);

      this.writeModel(config, modelName, fields, safeReferences, options);
    });

    if (!isUpdate) this.copyHandleBarsTemplate('public/favicon.png', 'public/favicon.png');

    modelNames.forEach(modelName => {
      // HACK: If a table name is "sessions" or "stats" the generated routes will conflict with
      //       Forest Admin internal route (session or stats creation).
      //       As a workaround, we don't generate the route file.
      // TODO: Remove the if condition, once the routes paths refactored to prevent such conflict.
      if (!Dumper.shouldSkipRouteGenerationForModel(modelName)) {
        this.writeRoute(config.dbConfig.dbDialect, modelName);
      }
    });

    if (!isUpdate) {
      this.copyHandleBarsTemplate('views/index.hbs', 'views/index.html');
      this.copyHandleBarsTemplate('dockerignore.hbs', '.dockerignore');
      this.writeDotEnv(config);
      this.copyHandleBarsTemplate('gitignore.hbs', '.gitignore');
      this.writeAppJs(config.dbConfig.dbDialect);
      this.writeDockerCompose(config);
      this.writeDockerfile();
      this.writePackageJson(config.dbConfig.dbDialect, config.appConfig.applicationName);
      this.copyHandleBarsTemplate('server.hbs', 'server.js');
    }
  }

  checkForestCLIProjectStructure() {
    try {
      if (!this.fs.existsSync('routes')) throw new Error('No "routes" directory.');
      if (!this.fs.existsSync('forest')) throw new Error('No "forest" directory.');
      if (!this.fs.existsSync('models')) throw new Error('No "models“ directory.');
    } catch (error) {
      throw new InvalidForestCLIProjectStructureError(this.projectPath, error);
    }
  }

  checkLianaCompatiblityForUpdate() {
    const packagePath = 'package.json';
    if (!this.fs.existsSync(packagePath))
      throw new IncompatibleLianaForUpdateError(`"${packagePath}" not found in current directory.`);

    const file = this.fs.readFileSync(packagePath, 'utf8');
    const match = /forest-express-\D*((\d+).\d+.\d+)/g.exec(file);

    let lianaMajorVersion = 0;
    if (match) {
      [, , lianaMajorVersion] = match;
    }
    if (Number(lianaMajorVersion) < 7) {
      throw new IncompatibleLianaForUpdateError(
        'Your project is not compatible with the `lforest schema:update` command. You need to use an agent version greater than 7.0.0.',
      );
    }
  }

  hasMultipleDatabaseStructure() {
    const files = this.fs.readdirSync('models', { withFileTypes: true });
    return !files.some(file => file.isFile() && file.name !== 'index.js');
  }
}

module.exports = Dumper;
