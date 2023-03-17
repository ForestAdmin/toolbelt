interface createCommandDbArgumentsBase {
  databaseDialect: string;
  databaseSSL: boolean;
  databaseSchema?: string;
  mongoDBSRV?: boolean;
}

interface createCommandDbArgumentsWithConnectionUrl extends createCommandDbArgumentsBase {
  databaseConnectionURL: string;
  databaseName?: never;
  databaseHost?: never;
  databasePort?: never;
  databaseUser?: never;
  databasePassword?: never;
}

interface createCommandDbArgumentsWithConnectionParams extends createCommandDbArgumentsBase {
  databaseConnectionURL?: never;
  databaseName: string;
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
}

type createCommandDbArguments =
  | createCommandDbArgumentsWithConnectionUrl
  | createCommandDbArgumentsWithConnectionParams;

export type createCommandArguments = createCommandDbArguments & {
  applicationName: string;
  applicationHost: string;
  applicationPort: number;
};
