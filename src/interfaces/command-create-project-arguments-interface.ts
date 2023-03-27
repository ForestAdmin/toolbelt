interface CreateCommandDbArgumentsBase {
  databaseDialect: string;
  databaseSSL: boolean;
  databaseSchema?: string;
}

interface CreateCommandDbArgumentsWithConnectionUrl extends CreateCommandDbArgumentsBase {
  databaseConnectionURL: string;
  databaseName?: never;
  databaseHost?: never;
  databasePort?: never;
  databaseUser?: never;
  databasePassword?: never;
  mongoDBSRV?: never;
}

interface CreateCommandDbArgumentsWithConnectionParams extends CreateCommandDbArgumentsBase {
  databaseConnectionURL?: never;
  databaseName: string;
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  mongoDBSRV?: boolean;
}

type CreateCommandDbArguments =
  | CreateCommandDbArgumentsWithConnectionUrl
  | CreateCommandDbArgumentsWithConnectionParams;

export type CreateCommandArguments = CreateCommandDbArguments & {
  applicationName: string;
  applicationHost: string;
  applicationPort: number;
};
