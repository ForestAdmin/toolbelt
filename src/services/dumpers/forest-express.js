const { URL } = require('url');
const { plural, singular } = require('pluralize');
const IncompatibleLianaForUpdateError = require('../../errors/dumper/incompatible-liana-for-update-error');
const InvalidForestCLIProjectStructureError = require('../../errors/dumper/invalid-forest-cli-project-structure-error');
const AbstractDumper = require('./abstract-dumper').default;

class ForestExpress extends AbstractDumper {
  constructor(context) {
    super(context);

    const {
      assertPresent,
      env,
      Sequelize,
      Handlebars,
      mkdirp,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      toValidPackageName,
      strings,
      lodash,
    } = context;

    assertPresent({
      env,
      Sequelize,
      Handlebars,
      mkdirp,
      isLinuxOs,
      buildDatabaseUrl,
      isDatabaseLocal,
      toValidPackageName,
      strings,
      lodash,
    });

    this.DEFAULT_PORT = 3310;
    this.env = env;
    this.isLinuxOs = isLinuxOs;
    this.Sequelize = Sequelize;
    this.Handlebars = Handlebars;
    this.mkdirp = mkdirp;
    this.lodash = lodash;
    this.buildDatabaseUrl = buildDatabaseUrl;
    this.isDatabaseLocal = isDatabaseLocal;
    this.toValidPackageName = toValidPackageName;
    this.strings = strings;
    this.lodash = lodash;
  }

  static getModelsNameSorted(schema) {
    return Object.keys(schema).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }

  getSafeReferences(references) {
    return references.map(reference => ({
      ...reference,
      ref: this.getModelNameFromTableName(reference.ref),
    }));
  }

  // HACK: If a table name is "sessions" or "stats" the generated routes will conflict with
  //       Forest Admin internal route (session or stats creation).
  static shouldSkipRouteGenerationForModel(modelName) {
    return ['sessions', 'stats'].includes(modelName.toLowerCase());
  }

  // eslint-disable-next-line class-methods-use-this
  get templateFolder() {
    return 'forest-express';
  }

  writePackageJson(dbDialect, appName) {
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
      name: this.toValidPackageName(appName),
      version: '0.0.1',
      private: true,
      scripts: { start: 'node ./server.js' },
      dependencies,
    };

    this.writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  tableToFilename(table) {
    return this.lodash.kebabCase(table);
  }

  static isLocalUrl(url) {
    return /^http:\/\/(?:localhost|127\.0\.0\.1)$/.test(url);
  }

  getApplicationUrl(appHostname, appPort) {
    const hostUrl = /^https?:\/\//.test(appHostname) ? appHostname : `http://${appHostname}`;

    return ForestExpress.isLocalUrl(hostUrl)
      ? `${hostUrl}:${appPort || this.DEFAULT_PORT}`
      : hostUrl;
  }

  writeDotEnv(config) {
    const port = config.appConfig.appPort || this.DEFAULT_PORT;
    const databaseUrl = this.buildDatabaseUrl(config.dbConfig);
    const context = {
      databaseUrl,
      ssl: config.dbConfig.dbSsl || 'false',
      dbSchema: config.dbConfig.dbSchema,
      hostname: config.appConfig.appHostname,
      port,
      forestEnvSecret: config.forestEnvSecret,
      forestAuthSecret: config.forestAuthSecret,
      hasDockerDatabaseUrl: false,
      applicationUrl: this.getApplicationUrl(config.appConfig.appHostname, port),
    };
    if (!this.isLinuxOs) {
      context.dockerDatabaseUrl = databaseUrl.replace('localhost', 'host.docker.internal');
      context.hasDockerDatabaseUrl = true;
    }
    this.copyHandleBarsTemplate('env.hbs', '.env', context);
  }

  getModelNameFromTableName(table) {
    return this.strings.transformToCamelCaseSafeString(table);
  }

  writeModel(config, table, fields, references, options = {}) {
    const { underscored } = options;
    let modelPath = `models/${this.tableToFilename(table)}.js`;
    if (config.appConfig.useMultiDatabase) {
      modelPath = `models/${config.appConfig.modelsExportPath}/${this.tableToFilename(table)}.js`;
    }

    const fieldsDefinition = fields.map(field => {
      const expectedConventionalColumnName = underscored
        ? this.lodash.snakeCase(field.name)
        : field.name;
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
        ref: field.ref && this.getModelNameFromTableName(field.ref),
        nameColumnUnconventional,
        hasParenthesis,

        // Only output default value when non-null
        hasSafeDefaultValue: !this.lodash.isNil(field.defaultValue),
        safeDefaultValue:
          field.defaultValue instanceof this.Sequelize.Utils.Literal
            ? `Sequelize.literal('${field.defaultValue.val.replace(/'/g, "\\'")}')`
            : JSON.stringify(field.defaultValue),
      };
    });

    const referencesDefinition = references.map(reference => ({
      ...reference,
      isBelongsToMany: reference.association === 'belongsToMany',
      targetKey: this.lodash.camelCase(reference.targetKey),
      sourceKey: this.lodash.camelCase(reference.sourceKey),
    }));

    this.copyHandleBarsTemplate(
      `models/${config.dbConfig.dbDialect === 'mongodb' ? 'mongo' : 'sequelize'}-model.hbs`,
      modelPath,
      {
        modelName: this.getModelNameFromTableName(table),
        modelVariableName: this.strings.pascalCase(this.strings.transformToSafeString(table)),
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
    const routesPath = `routes/${this.tableToFilename(modelName)}.js`;

    const modelNameDasherized = this.lodash.kebabCase(modelName);
    const readableModelName = this.lodash.startCase(modelName);

    this.copyHandleBarsTemplate('routes/route.hbs', routesPath, {
      modelName: this.getModelNameFromTableName(modelName),
      modelNameDasherized,
      modelNameReadablePlural: plural(readableModelName),
      modelNameReadableSingular: singular(readableModelName),
      isMongoDB: dbDialect === 'mongodb',
    });
  }

  writeForestCollection(dbDialect, table) {
    const collectionPath = `forest/${this.tableToFilename(table)}.js`;

    this.copyHandleBarsTemplate('forest/collection.hbs', collectionPath, {
      isMongoDB: dbDialect === 'mongodb',
      table: this.getModelNameFromTableName(table),
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

  writeDatabasesConfig(dbDialect) {
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
    const databaseUrl = `\${${this.isLinuxOs ? 'DATABASE_URL' : 'DOCKER_DATABASE_URL'}}`;
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
      containerName: this.lodash.snakeCase(config.appConfig.appName),
      databaseUrl,
      dbSchema: config.dbConfig.dbSchema,
      forestExtraHost,
      forestUrl,
      network: this.isLinuxOs && this.isDatabaseLocal(config.dbConfig) ? 'host' : null,
    });
  }

  writeForestAdminMiddleware(dbDialect) {
    this.copyHandleBarsTemplate('middlewares/forestadmin.hbs', 'middlewares/forestadmin.js', {
      isMongoDB: dbDialect === 'mongodb',
    });
  }

  // NOTICE: Generate files in alphabetical order to ensure a nice generation console logs display.
  async createFiles(config, schema) {
    const { isUpdate, useMultiDatabase, modelsExportPath } = config.appConfig;

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

    const modelNames = ForestExpress.getModelsNameSorted(schema);

    if (!isUpdate) this.writeDatabasesConfig(config.dbConfig.dbDialect);

    modelNames.forEach(modelName =>
      this.writeForestCollection(config.dbConfig.dbDialect, modelName),
    );

    if (!isUpdate) {
      this.writeForestAdminMiddleware(config.dbConfig.dbDialect);
      this.copyHandleBarsTemplate('middlewares/welcome.hbs', 'middlewares/welcome.js');
      this.writeModelsIndex(config.dbConfig.dbDialect);
    }

    modelNames.forEach(modelName => {
      const { fields, references, options } = schema[modelName];
      const safeReferences = this.getSafeReferences(references);

      this.writeModel(config, modelName, fields, safeReferences, options);
    });

    if (!isUpdate) this.copyHandleBarsTemplate('public/favicon.png', 'public/favicon.png');

    modelNames.forEach(modelName => {
      // HACK: If a table name is "sessions" or "stats" the generated routes will conflict with
      //       Forest Admin internal route (session or stats creation).
      //       As a workaround, we don't generate the route file.
      // TODO: Remove the if condition, once the routes paths refactored to prevent such conflict.
      if (!ForestExpress.shouldSkipRouteGenerationForModel(modelName)) {
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
      this.writePackageJson(config.dbConfig.dbDialect, config.appConfig.appName);
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

module.exports = ForestExpress;
