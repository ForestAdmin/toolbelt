import type { CommandOptions } from './option-parser';

import languages from './languages';
import { validateAppHostname, validateDbName, validatePort } from './validators';

export type ProjectCreateOptions = {
  applicationName: string;
  applicationHost: string;
  applicationPort: string;
  databaseConnectionURL?: string;
  databaseName?: string;
  databaseHost?: string;
  databasePort?: string;
  databaseUser?: string;
  databasePassword?: string;
  databaseSSL?: boolean;

  databaseDialect?: 'mariadb' | 'mssql' | 'mysql' | 'postgres' | 'mongodb';
  databaseSchema?: string;
  mongoDBSRV?: boolean;

  language?: 'typescript' | 'javascript';
};

type Option = CommandOptions<ProjectCreateOptions>[string];

function getDialect(options: ProjectCreateOptions): ProjectCreateOptions['databaseDialect'] {
  const { databaseDialect: dialect, databaseConnectionURL: url } = options;

  if (dialect) return dialect;
  if (url?.startsWith('postgres://')) return 'postgres';
  if (url?.startsWith('mssql://')) return 'mssql';
  if (url?.startsWith('mongodb')) return 'mongodb';
  if (url?.startsWith('mysql://') || url?.startsWith('mariadb://')) return 'mysql';

  return null;
}

export const applicationHost: Option = {
  description: 'Hostname of your admin backend application.',
  default: () => 'http://localhost',
  validate: validateAppHostname,
  oclif: { char: 'H' },
};

export const applicationPort: Option = {
  description: 'Port of your admin backend application.',
  default: () => '3310',
  validate: validatePort,
  oclif: { char: 'P' },
};

export const databaseConnectionURL: Option = {
  description: 'Enter the database credentials with a connection URL.',
  oclif: { char: 'c' },
  prompter: { skip: true },
};

export const databaseName: Option = {
  description: 'Enter your database name.',
  exclusive: ['dbConnectionUrl'],
  validate: validateDbName,
  oclif: { char: 'n' },
};

export const databaseHost: Option = {
  description: 'Enter your database host.',
  exclusive: ['dbConnectionUrl'],
  default: () => 'localhost',
  oclif: { char: 'h' },
};

export const databasePort: Option = {
  description: 'Enter your database port.',
  exclusive: ['dbConnectionUrl'],
  default: args => {
    const dialect = getDialect(args);
    if (dialect === 'postgres') return '5432';
    if (dialect === 'mysql' || dialect === 'mariadb') return '3306';
    if (dialect === 'mssql') return '1433';
    return undefined;
  },
  validate: validatePort,
  oclif: { char: 'p' },
};

export const databaseUser: Option = {
  description: 'Enter your database user.',
  exclusive: ['dbConnectionUrl'],
  default: args => (getDialect(args) === 'mongodb' ? undefined : 'root'),
  oclif: { char: 'u' },
};
export const databasePassword: Option = {
  description: 'Enter your database password.',
  exclusive: ['dbConnectionUrl'],
};

export const databaseSSL: Option = {
  type: 'boolean',
  description: 'Use SSL for database connection.',
  default: () => 'no',
};

export const language: Option = {
  description: 'Choose the language you want to use for your project.',
  choices: Object.values(languages).map(l => l.name),
  default: () => Object.values(languages)[0].name,
  oclif: { char: 'l' },
};

export const databaseDialectV1: Option = {
  description: 'Enter your database dialect.',
  choices: ['mssql', 'mysql', 'postgres', 'mongodb'],
  exclusive: ['dbConnectionUrl'],
  oclif: { char: 'd' },
};

export const databaseDialectMongoV2: Option = {
  description: 'Enter your database dialect.',
  choices: ['mongodb'],
  exclusive: ['dbConnectionUrl'],
  oclif: { char: 'd' },
};

export const databaseDialectSqlV2: Option = {
  description: 'Enter your database dialect.',
  choices: ['mssql', 'mysql', 'postgres'],
  exclusive: ['dbConnectionUrl'],
  oclif: { char: 'd' },
};

export const databaseSchema: Option = {
  description: 'Enter your database schema.',
  exclusive: ['dbConnectionUrl'],
  when: args => !['mariadb', 'mysql'].includes(getDialect(args)),
  default: args => (getDialect(args) === 'postgres' ? 'public' : ''),
  oclif: { char: 's' },
};

export const mongoDBSRV: Option = {
  type: 'boolean',
  description: 'Use SRV DNS record for mongoDB connection.',
  exclusive: ['dbConnectionUrl'],
  when: args => getDialect(args) === 'mongodb',
};
