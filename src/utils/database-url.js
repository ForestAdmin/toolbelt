function buildDatabaseUrl(config) {
  let connectionString;

  if (config.dbConnectionUrl) {
    connectionString = config.dbConnectionUrl;
  } else {
    let protocol = config.dbDialect;
    let port = `:${config.dbPort}`;
    let password = '';

    if (config.dbDialect === 'mongodb' && config.mongodbSrv) {
      protocol = 'mongodb+srv';
      port = '';
    }

    if (config.dbPassword) {
      // NOTICE: Encode password string in case of special chars.
      password = `:${encodeURIComponent(config.dbPassword)}`;
    }

    connectionString = `${protocol}://${config.dbUser}${password}@${config.dbHostname}${port}/${config.dbName}`;
  }

  return connectionString;
}

module.exports = {
  buildDatabaseUrl,
};
