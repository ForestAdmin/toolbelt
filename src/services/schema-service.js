const LumberError = require('../../utils/lumber-error');

module.exports = class SchemaService {
  constructor({
    assertPresent,
    database,
    databaseAnalyzer,
    dumper,
    env,
    errorHandler,
    fs,
    logger,
    path,
    spinners,
  }) {
    assertPresent({
      database,
      databaseAnalyzer,
      dumper,
      env,
      errorHandler,
      fs,
      logger,
      path,
      spinners,
    });
    this.database = database;
    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
    this.env = env;
    this.errorHandler = errorHandler;
    this.fs = fs;
    this.logger = logger;
    this.path = path;
    this.spinners = spinners;
  }

  _assertOutputDirectory(outputDirectory) {
    if (!outputDirectory) {
      this.dumper.checkLumberProjectStructure();
    } else if (this.fs.existsSync(outputDirectory)) {
      throw new LumberError(`The output directory "${outputDirectory}" already exist.`);
    }
  }

  _getDatabasesConfig(path) {
    const configPath = this.path.resolve(path);
    if (!this.fs.existsSync(configPath)) {
      throw new LumberError(`The configuration file "${configPath}" does not exist.`);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const databasesConfig = require(configPath);
    if (!this.database.areAllDatabasesOfTheSameType(databasesConfig)) {
      throw new LumberError(`The "${configPath}" file contains different databases types.`);
    }
    return databasesConfig;
  }

  async _connectToDatabases(databasesConfig) {
    const spinner = this.spinners.add(
      'databases-connection',
      {
        text: 'Connecting to your database(s)',
      },
    );
    const databasesConnection = await this.database.connectFromDatabasesConfig(databasesConfig);
    spinner.succeed();
    return databasesConnection;
  }

  async _analyzeDatabases(databasesConnection, dbSchema) {
    const spinner = this.spinners.add('analyze-databases', { text: 'Analyzing the database(s)' });
    const databasesSchema = await Promise.all(
      databasesConnection
        .map(async (databaseConnection) => {
          const analyzerOptions = {
            dbDialect: this.database.getDialect(databaseConnection.connection.url),
            dbSchema,
          };

          const schema = await this.databaseAnalyzer
            .analyze(databaseConnection.connectionInstance, analyzerOptions, true);

          return {
            ...databaseConnection,
            schema,
            analyzerOptions,
          };
        }),
    );
    spinner.succeed();
    return databasesSchema;
  }

  async _dumpSchemas(databasesSchema, appName, isUpdate, useMultiDatabase) {
    const spinner = this.spinners.add('dumper', { text: 'Generating your files' });

    const dumperOptions = {
      appName,
      isUpdate,
      useMultiDatabase,
      modelsExportPath: '', // Value is defined below, it's different for each schema
      dbDialect: null, // Value is defined below, it's coming from each analyzerOptions
      dbSchema: null, // Value is defined below, it's coming from each analyzerOptions
    };

    await Promise.all(databasesSchema.map((databaseSchema) =>
      this.dumper.dump(databaseSchema.schema, {
        ...dumperOptions,
        modelsExportPath: this.path.relative('models', databaseSchema.modelsDir),
        dbDialect: databaseSchema.analyzerOptions.dbDialect,
        dbSchema: databaseSchema.analyzerOptions.dbSchema,
      })));

    spinner.succeed();
  }

  _warnIfSingleToMulti(outputDirectory, useMultiDatabase) {
    const fromSingleToMultipleDatabases = !outputDirectory
      && useMultiDatabase
      && !this.dumper.hasMultipleDatabaseStructure();
    if (fromSingleToMultipleDatabases) {
      this.logger.warn('It looks like you are switching from a single to a multiple databases.');
      this.logger.log('You will need to move the models files from your existing database to'
        + ' the dedicated folder, or simply remove them.');
    }
  }

  async update({
    isUpdate, outputDirectory, dbSchema, dbConfigPath,
  }) {
    try {
      this.dumper.checkLianaCompatiblityForUpdate();
      this._assertOutputDirectory(outputDirectory);
      const databasesConfig = this._getDatabasesConfig(dbConfigPath);
      const databasesConnection = await this._connectToDatabases(databasesConfig);
      const databasesSchema = await this._analyzeDatabases(databasesConnection, dbSchema);
      const useMultiDatabase = databasesSchema.length > 1;

      await this._dumpSchemas(databasesSchema, outputDirectory, isUpdate, useMultiDatabase);

      this._warnIfSingleToMulti();
    } catch (error) {
      await this.errorHandler.handle(error);
    }
  }
};
