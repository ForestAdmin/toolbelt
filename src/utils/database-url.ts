import type { DbConfig } from '../interfaces/project-create-interface';

export default function buildDatabaseUrl(dbConfig: DbConfig): string | null {
  let connectionString: string;

  if (!dbConfig) {
    return null;
  }

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

export function isDatabaseLocal(dbConfig: DbConfig): boolean {
  const databaseUrl = buildDatabaseUrl(dbConfig);
  return !!databaseUrl && (databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost'));
}
