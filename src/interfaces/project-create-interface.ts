interface DbConfigBase {
  dbDialect: string;
  dbSsl: boolean;
  dbSchema?: string;
  mongodbSrv?: boolean;
}

interface DbConfigWithConnectionUrl extends DbConfigBase {
  dbConnectionUrl: string;
  dbName?: never;
  dbHostname?: never;
  dbPort?: never;
  dbUser?: never;
  dbPassword?: never;
}

interface DbConfigWithConnectionParams extends DbConfigBase {
  dbConnectionUrl?: never;
  dbName: string;
  dbHostname: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
}

export type DbConfig = DbConfigWithConnectionUrl | DbConfigWithConnectionParams;

export interface AppConfig {
  appName: string;
  appHostname: string;
  appPort: number;
  isUpdate?: boolean;
  useMultipleDatabase?: boolean;
  modelsExportPath?: string;
}

export interface Config {
  dbConfig: DbConfig;
  appConfig: AppConfig;
  forestAuthSecret: string;
  forestEnvSecret: string;
}
export interface ProcessedArguments {
  applicationName: string;
  applicationHost: string;
  applicationPort: number;
  databaseConnectionURL?: string;
  databaseDialect?: string;
  databaseHost: string;
  databaseName: string;
  databasePassword: string;
  databasePort: number;
  databaseSchema?: string;
  databaseUser: string;
  databaseSSL: boolean;
  mongoDBSRV?: boolean;
}
