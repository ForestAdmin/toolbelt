export interface DbConfigInterface {
  dbConnectionUrl?: string;
  dbDialect?: string;
  dbHostname?: string;
  dbName?: string;
  dbPassword?: string;
  dbPort?: number;
  dbSchema?: string;
  dbUser?: string;
  mongodbSrv?: boolean;
  ssl: boolean;
}

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
