const ForestCLIError = require('../../errors/forest-cli-error');

module.exports = class SchemaService {
  constructor({
    assertPresent,
    constants,
    database,
    databaseAnalyzer,
    dumper,
    env,
    errorHandler,
    fs,
    logger,
    path,
    spinner,
  }) {
    assertPresent({
      constants,
      database,
      databaseAnalyzer,
      dumper,
      env,
      errorHandler,
      fs,
      logger,
      path,
      spinner,
    });
    this.constants = constants;
    this.database = database;
    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
    this.env = env;
    this.errorHandler = errorHandler;
    this.fs = fs;
    this.logger = logger;
    this.path = path;
    this.spinner = spinner;
  }

  _assertOutputDirectory(outputDirectory) {
    if (!outputDirectory) {
      this.dumper.checkForestCLIProjectStructure();
    } else if (this.fs.existsSync(outputDirectory)) {
      throw new ForestCLIError(`The output directory "${outputDirectory}" already exists.`);
    }
  }

  _getDatabasesConfig(path) {
    const configPath = this.path.resolve(this.constants.CURRENT_WORKING_DIRECTORY, path);
    if (!this.fs.existsSync(configPath)) {
      throw new ForestCLIError(`The configuration file "${configPath}" does not exist.`);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const databasesConfig = require(configPath);
    if (!this.database.areAllDatabasesOfTheSameType(databasesConfig)) {
      throw new ForestCLIError(`The "${configPath}" file contains different databases types.`);
    }
    return databasesConfig;
  }

  async _connectToDatabases(databasesConfig) {
    this.spinner.start({ text: 'Connecting to your database(s)' });
    const databasesConnectionPromise = this.database.connectFromDatabasesConfig(databasesConfig);
    return this.spinner.attachToPromise(databasesConnectionPromise);
  }

  async _disconnectFromDatabases(databaseConnections) {
    this.spinner.start({ text: 'Disconnecting from your database(s)' });
    const databasesConnectionPromise = this.database.disconnectFromDatabases(databaseConnections);
    return this.spinner.attachToPromise(databasesConnectionPromise);
  }

  async _analyzeDatabases(databasesConnection, dbSchema) {
    this.spinner.start({ text: 'Analyzing the database(s)' });
    const databasesSchemaPromise = Promise.all(
      databasesConnection.map(async databaseConnection => {
        const analyzerOptions = {
          dbDialect: this.database.getDialect(databaseConnection.connection.url),
          dbSchema,
        };

        const schema = await this.databaseAnalyzer.analyze(
          databaseConnection.connectionInstance,
          analyzerOptions,
          true,
        );

        return {
          ...databaseConnection,
          schema,
          analyzerOptions,
        };
      }),
    );
    return this.spinner.attachToPromise(databasesSchemaPromise);
  }

  async _dumpSchemas(databasesSchema, applicationName, isUpdate, useMultiDatabase) {
    this.spinner.start({ text: 'Generating your files' });

    const dumperOptions = {
      applicationName,
      isUpdate,
      useMultiDatabase,
      modelsExportPath: '', // Value is defined below, it's different for each schema
      dbDialect: null, // Value is defined below, it's coming from each analyzerOptions
      dbSchema: null, // Value is defined below, it's coming from each analyzerOptions
    };

    const dumpPromise = Promise.all(
      databasesSchema.map(databaseSchema =>
        this.dumper.dump(databaseSchema.schema, {
          ...dumperOptions,
          modelsExportPath: this.path.relative('models', databaseSchema.modelsDir),
          dbDialect: databaseSchema.analyzerOptions.dbDialect,
          dbSchema: databaseSchema.analyzerOptions.dbSchema,
        }),
      ),
    );
    return this.spinner.attachToPromise(dumpPromise);
  }

  _warnIfSingleToMulti(outputDirectory, useMultiDatabase) {
    const fromSingleToMultipleDatabases =
      !outputDirectory && useMultiDatabase && !this.dumper.hasMultipleDatabaseStructure();
    if (fromSingleToMultipleDatabases) {
      this.logger.warn('It looks like you are switching from a single to a multiple databases.');
      this.logger.log(
        'You will need to move the models files from your existing database to' +
          ' the dedicated folder, or simply remove them.',
      );
    }
  }

  async _update({ isUpdate, outputDirectory, dbSchema, dbConfigPath }) {
    this.dumper.checkLianaCompatiblityForUpdate();
    this._assertOutputDirectory(outputDirectory);
    const databasesConfig = this._getDatabasesConfig(dbConfigPath);
    const databasesConnection = await this._connectToDatabases(databasesConfig);
    const databasesSchema = await this._analyzeDatabases(databasesConnection, dbSchema);
    await this._disconnectFromDatabases(databasesConnection);
    const useMultiDatabase = databasesSchema.length > 1;

    await this._dumpSchemas(databasesSchema, outputDirectory, isUpdate, useMultiDatabase);

    this._warnIfSingleToMulti(outputDirectory, useMultiDatabase);
  }

  async update(options) {
    try {
      await this._update(options);
    } catch (error) {
      await this.errorHandler.handle(error);
    }
  }
};
