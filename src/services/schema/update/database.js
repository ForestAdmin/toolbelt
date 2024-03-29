class Database {
  constructor({ assertPresent, mongodb, Sequelize, terminator }) {
    assertPresent({
      mongodb,
      Sequelize,
      terminator,
    });
    this.mongodb = mongodb;
    this.Sequelize = Sequelize;
    this.terminator = terminator;
  }

  async handleAuthenticationError(error) {
    return this.terminator.terminate(1, {
      logs: ['Cannot connect to the database due to the following error:', error],
      errorCode: 'database_authentication_error',
      errorMessage: error.message,
    });
  }

  sequelizeAuthenticate(connection) {
    return connection
      .authenticate()
      .then(() => connection)
      .catch(error => this.handleAuthenticationError(error));
  }

  // eslint-disable-next-line class-methods-use-this
  getDialect(dbConnectionUrl, dbDialect) {
    if (dbConnectionUrl) {
      if (dbConnectionUrl.startsWith('postgres://')) {
        return 'postgres';
      }
      if (dbConnectionUrl.startsWith('mysql://')) {
        return 'mysql';
      }
      if (dbConnectionUrl.startsWith('mssql://')) {
        return 'mssql';
      }
      // NOTICE: For MongoDB can be "mongodb://" or "mongodb+srv://"
      if (dbConnectionUrl.startsWith('mongodb')) {
        return 'mongodb';
      }
    }
    return dbDialect;
  }

  connectToMongodb(options, isSSL) {
    let connectionOptionsMongoClient = options.connectionOptions;
    if (!connectionOptionsMongoClient) {
      connectionOptionsMongoClient = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      };
      if (isSSL) {
        connectionOptionsMongoClient.ssl = true;
      }
    }

    let connectionUrl = options.dbConnectionUrl;
    if (!connectionUrl) {
      connectionUrl = 'mongodb';
      if (options.mongodbSrv) {
        connectionUrl += '+srv';
      }
      connectionUrl += '://';
      if (options.dbUser) {
        connectionUrl += options.dbUser;
      }
      if (options.dbPassword) {
        connectionUrl += `:${options.dbPassword}`;
      }
      if (options.dbUser || options.dbPassword) {
        connectionUrl += '@';
      }
      connectionUrl += options.dbHostname;
      if (!options.mongodbSrv) {
        connectionUrl += `:${options.dbPort}`;
      }
      connectionUrl += `/${options.dbName}`;
    }

    return this.mongodb.MongoClient.connect(connectionUrl, connectionOptionsMongoClient).catch(
      error => this.handleAuthenticationError(error),
    );
  }

  connectToSequelize(databaseDialect, options, isSSL) {
    let connectionOptionsSequelize = options.connectionOptions;
    if (!connectionOptionsSequelize) {
      connectionOptionsSequelize = {};

      if (databaseDialect === 'mssql') {
        connectionOptionsSequelize.dialectOptions = { options: { encrypt: isSSL } };
      } else if (isSSL) {
        // Add SSL options only if the user selected SSL mode.
        // SSL Cerificate is always trusted during `forest projects:create` command
        // to ease their onboarding.
        connectionOptionsSequelize.dialectOptions = { ssl: { rejectUnauthorized: false } };
      }
    }

    connectionOptionsSequelize.logging = false;

    let connection;
    if (options.dbConnectionUrl) {
      connection = new this.Sequelize(options.dbConnectionUrl, connectionOptionsSequelize);
    } else {
      connectionOptionsSequelize.host = options.dbHostname;
      connectionOptionsSequelize.port = options.dbPort;
      connectionOptionsSequelize.dialect = databaseDialect;

      connection = new this.Sequelize(
        options.dbName,
        options.dbUser,
        options.dbPassword,
        connectionOptionsSequelize,
      );
    }

    return this.sequelizeAuthenticate(connection);
  }

  async connect(options) {
    const isSSL = options.dbSSL || options.dbSsl;
    const databaseDialect = this.getDialect(options.dbConnectionUrl, options.dbDialect);

    if (databaseDialect === 'mongodb') {
      return this.connectToMongodb(options, isSSL);
    }

    return this.connectToSequelize(databaseDialect, options, isSSL);
  }

  connectFromDatabasesConfig(databasesConfig) {
    return Promise.all(
      databasesConfig.map(async databaseConfig => {
        const connectionOptions = { ...databaseConfig.connection.options };

        const connectionInstance = await this.connect({
          dbConnectionUrl: databaseConfig.connection.url,
          connectionOptions,
        });

        return {
          ...databaseConfig,
          connectionInstance,
        };
      }),
    );
  }

  // eslint-disable-next-line class-methods-use-this
  disconnectFromDatabases(databaseConnections) {
    return Promise.all(
      databaseConnections.map(connection => this.disconnect(connection.connectionInstance)),
    );
  }

  // eslint-disable-next-line class-methods-use-this
  async disconnect(connection) {
    return connection.close();
  }

  areAllDatabasesOfTheSameType(databasesConfig) {
    const databasesDialect = databasesConfig.map(databaseConfig =>
      this.getDialect(databaseConfig.connection.url),
    );

    const hasMongoDb = databasesDialect.some(dialect => dialect === 'mongodb');
    const hasAnotherDbType = databasesDialect.some(dialect => dialect !== 'mongodb');

    return !(hasMongoDb && hasAnotherDbType);
  }
}

module.exports = Database;
