interface CreateCommandDbArgumentsBase {
  databaseDialect: string;
  databaseSSL: boolean;
  databaseSchema?: string;
  mongoDBSRV?: boolean;
}

interface CreateCommandDbArgumentsWithConnectionUrl extends CreateCommandDbArgumentsBase {
  databaseConnectionURL: string;
  databaseName?: never;
  databaseHost?: never;
  databasePort?: never;
  databaseUser?: never;
  databasePassword?: never;
}

interface CreateCommandDbArgumentsWithConnectionParams extends CreateCommandDbArgumentsBase {
  databaseConnectionURL?: never;
  databaseName: string;
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
}

type CreateCommandDbArguments =
  | CreateCommandDbArgumentsWithConnectionUrl
  | CreateCommandDbArgumentsWithConnectionParams;

export type CreateCommandArguments = CreateCommandDbArguments & {
  applicationName: string;
  applicationHost: string;
  applicationPort: number;
};
