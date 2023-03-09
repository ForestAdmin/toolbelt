interface DbConfigBase {
  dbDialect: string;
  ssl: boolean;
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

export type DbConfigInterface = DbConfigWithConnectionUrl | DbConfigWithConnectionParams;
export interface AppConfig {
  applicationName: string;
  appHostname: string;
  appPort: number;
  isUpdate?: boolean;
  useMultipleDatabase?: boolean;
  modelsExportPath?: string;
}

export interface ConfigInterface {
  dbConfig: DbConfigInterface;
  appConfig: AppConfig;
  forestAuthSecret: string;
  forestEnvSecret: string;
}
