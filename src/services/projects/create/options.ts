import type { Language } from '../../../utils/languages';
import type { CommandOptions } from '../../../utils/option-parser';

import languages from '../../../utils/languages';
import { validateAppHostname, validateDbName, validatePort } from '../../../utils/validators';

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

  language?: Language;
};

type Option = CommandOptions<ProjectCreateOptions>[string];

export function getDialect(options: ProjectCreateOptions): ProjectCreateOptions['databaseDialect'] {
  const { databaseDialect: dialect, databaseConnectionURL: url } = options;

  if (dialect) return dialect;
  if (url?.startsWith('postgres://')) return 'postgres';
  if (url?.startsWith('mssql://')) return 'mssql';
  if (url?.startsWith('mongodb')) return 'mongodb';
  if (url?.startsWith('mysql://') || url?.startsWith('mariadb://')) return 'mysql';

  return null;
}

export const applicationHost: Option = {
  default: 'http://localhost',
  validate: validateAppHostname,
  oclif: { char: 'H', description: 'Hostname of your admin backend application.' },
  prompter: { question: "What's the IP/hostname on which your application will be running?" },
};

export const applicationPort: Option = {
  default: '3310',
  validate: validatePort,
  oclif: { char: 'P', description: 'Port of your admin backend application.' },
  prompter: { question: `What's the port on which your application will be running?` },
};

export const databaseConnectionURL: Option = {
  oclif: { char: 'c', description: 'Enter the database credentials with a connection URL.' },
  prompter: null,
};

export const databaseName: Option = {
  exclusive: ['databaseConnectionURL'],
  validate: validateDbName,
  oclif: { char: 'n', description: 'Enter your database name.' },
  prompter: { question: "What's the database name?" },
};

export const databaseHost: Option = {
  exclusive: ['databaseConnectionURL'],
  default: 'localhost',
  oclif: { char: 'h', description: 'Enter your database host.' },
  prompter: { question: "What's the database hostname?" },
};

export const databasePort: Option = {
  exclusive: ['databaseConnectionURL'],
  default: args => {
    const dialect = getDialect(args);
    if (dialect === 'postgres') return '5432';
    if (dialect === 'mysql' || dialect === 'mariadb') return '3306';
    if (dialect === 'mssql') return '1433';
    if (dialect === 'mongodb') return '27017';
    return undefined;
  },
  validate: validatePort,
  oclif: { char: 'p', description: 'Enter your database port.' },
  prompter: { question: "What's the database port?" },
};

export const databaseUser: Option = {
  exclusive: ['databaseConnectionURL'],
  default: args => (getDialect(args) === 'mongodb' ? undefined : 'root'),
  oclif: { char: 'u', description: 'Enter your database user.' },
  prompter: { question: "What's the database user?" },
};

export const databasePassword: Option = {
  exclusive: ['databaseConnectionURL'],
  oclif: { description: 'Enter your database password.' },
  prompter: { question: "What's the database password? [optional]" },
};

export const databaseSSL: Option = {
  type: 'boolean',
  default: false,
  oclif: { description: 'Use SSL for database connection.' },

  // Replicate bug from previous version of the CLI where this variable was never prompted
  // this should be: prompter: { question: 'Does your database require a SSL connection?' }
  prompter: null,
};

export const language: Option = {
  choices: Object.values(languages).map(l => ({ name: l.name, value: l })),
  default: Object.values(languages)[0],
  oclif: { char: 'l', description: 'Choose the language you want to use for your project.' },
  prompter: { question: 'In which language would you like to generate your sources?' },
};

export const databaseDialectV1: Option = {
  choices: [
    { name: 'mongodb', value: 'mongodb' },
    { name: 'mssql', value: 'mssql' },
    { name: 'mysql / mariadb', value: 'mysql' },
    { name: 'postgres', value: 'postgres' },
  ],
  exclusive: ['databaseConnectionURL'],
  oclif: { char: 'd', description: 'Enter your database dialect.' },
  prompter: { question: "What's the database type?" },
};

export const databaseDialectSqlV2: Option = {
  choices: [
    { name: 'mssql', value: 'mssql' },
    { name: 'mysql / mariadb', value: 'mysql' },
    { name: 'postgres', value: 'postgres' },
  ],
  exclusive: ['databaseConnectionURL'],
  oclif: { char: 'd', description: 'Enter your database dialect.' },
  prompter: { question: "What's the database type?" },
};

export const databaseSchema: Option = {
  when: args => !['mariadb', 'mysql', 'mongodb'].includes(getDialect(args)),
  default: args => (getDialect(args) === 'postgres' ? 'public' : ''),
  oclif: { char: 's', description: 'Enter your database schema.' },
  prompter: {
    question: "What's the database schema? [optional]",
    description: 'Leave blank by default',
  },
};

export const mongoDBSRV: Option = {
  type: 'boolean',
  exclusive: ['databaseConnectionURL'],
  when: args => getDialect(args) === 'mongodb',
  default: false,
  oclif: { description: 'Use SRV DNS record for mongoDB connection.' },
  prompter: { question: 'Use a SRV connection string?' },
};
