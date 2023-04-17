import type { Language } from '../utils/languages';

interface DbConfigBase {
  dbDialect: string;
  dbSsl: boolean;
  dbSchema?: string;
}

interface DbConfigWithConnectionUrl extends DbConfigBase {
  dbConnectionUrl: string;
  dbName?: never;
  dbHostname?: never;
  dbPort?: never;
  dbUser?: never;
  dbPassword?: never;
  mongodbSrv?: never;
}

interface DbConfigWithConnectionParams extends DbConfigBase {
  dbConnectionUrl?: never;
  dbName: string;
  dbHostname: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  mongodbSrv?: boolean;
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
  language: Language | null;
}
