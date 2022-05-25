function buildDatabaseUrl(config) {
  let connectionString;

  if (!config) {
    return null;
  }

  if (config.dbConnectionUrl) {
    connectionString = config.dbConnectionUrl;
  } else {
    let protocol = config.databaseDialect;
    let port = `:${config.databasePort}`;
    let password = '';

    if (config.dbDialect === 'mongodb' && config.mongodbSrv) {
      protocol = 'mongodb+srv';
      port = '';
    }

    if (config.databasePassword) {
      // NOTICE: Encode password string in case of special chars.
      password = `:${encodeURIComponent(config.databasePassword)}`;
    }

    connectionString = `${protocol}://${config.databaseUser}${password}@${config.databaseHost}${port}/${config.databaseName}`;
  }

  return connectionString;
}

module.exports = {
  buildDatabaseUrl,
};
