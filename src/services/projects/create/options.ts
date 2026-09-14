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
  databaseSslMode?: 'preferred' | 'disabled' | 'required' | 'verify';

  databaseDialect?: 'mariadb' | 'mssql' | 'mysql' | 'postgres' | 'mongodb';
  databaseSchema?: string;
  mongoDBSRV?: boolean;

  language?: Language;
};

type Option = CommandOptions<ProjectCreateOptions>[string];

export function getDialect(options: ProjectCreateOptions): ProjectCreateOptions['databaseDialect'] {
  const { databaseDialect: dialect, databaseConnectionURL } = options;

  if (dialect) return dialect;

  // URL schemes are case-insensitive. Compare on a lowercased copy only: the credentials the URL
  // carries are case-sensitive, and the value itself is handed over to the driver untouched.
  const url = databaseConnectionURL?.toLowerCase();

  if (url?.startsWith('postgres')) return 'postgres';
  if (url?.startsWith('mssql://')) return 'mssql';
  if (url?.startsWith('mongodb')) return 'mongodb';
  if (url?.startsWith('mysql://') || url?.startsWith('mariadb://')) return 'mysql';

  return null;
}

// Skip a field prompt when the user has provided a connection URL instead (used by sql/nosql).
export const skipWhenConnectionUrl = (args: ProjectCreateOptions): boolean =>
  !args.databaseConnectionURL;

// Normalizes the answer before `when`/`validate`/getDialect() see it: a URL pasted out of a
// dashboard drags whitespace along, and getDialect() matches the scheme with startsWith().
export const trimConnectionUrl = (value: string): string => value?.trim() ?? value;

const SQL_URL_SCHEMES = ['postgres', 'postgresql', 'mysql', 'mssql'];
const MONGO_URL_SCHEMES = ['mongodb', 'mongodb+srv'];

// Accept a blank value (⇒ fill the fields instead) or a real `scheme://…` for the engine family.
// Each rejection says what is actually wrong — this is the first thing a user sees when
// onboarding, a single catch-all message sends them guessing.
function validateConnectionUrl(
  value: string,
  schemes: string[],
  example: string,
  {
    lowercaseOnly = false,
    hints = {},
  }: { lowercaseOnly?: boolean; hints?: Record<string, string> } = {},
): boolean | string {
  const url = value?.trim();
  if (!url) return true;

  const [, scheme, rest] = /^([a-z0-9+.-]+):\/\/(.*)$/i.exec(url) ?? [];
  if (!scheme) return `Enter a connection URL like ${example}`;
  if (!rest) return `The URL is missing everything after "${scheme}://" — try ${example}`;

  const lowercased = scheme.toLowerCase();

  // hasOwnProperty: the scheme is user input, `constructor://…` must not resolve on the prototype.
  if (Object.prototype.hasOwnProperty.call(hints, lowercased)) return hints[lowercased];
  if (!schemes.includes(lowercased)) {
    return `"${scheme}://" is not supported, expected ${schemes.map(s => `${s}://`).join(', ')}`;
  }
  if (lowercaseOnly && scheme !== lowercased) {
    return `The scheme must be lowercase: use "${lowercased}://"`;
  }

  return true;
}

// The scheme's case is left alone: Sequelize and @forestadmin/datasource-sql both parse the URL
// with a WHATWG/legacy URL parser, which normalizes the scheme, so `Postgres://…` connects and
// generates a working project.
export function validateSqlConnectionUrl(value: string): boolean | string {
  return validateConnectionUrl(value, SQL_URL_SCHEMES, 'postgres://user:password@host:5432/db', {
    hints: {
      // getDialect() maps mariadb:// to the mysql dialect, so the generated project ships mysql2
      // while the driver derives `mariadb` from the URL scheme and fails to connect at runtime.
      mariadb: 'mariadb:// is not supported by the generated project, use mysql:// instead',
    },
  });
}

// Unlike the SQL drivers, the mongodb driver compares the scheme verbatim and throws
// "Invalid scheme, expected connection string to start with mongodb://" on `MongoDB://…`.
// Rejecting it here keeps the failure in the prompt, before the project is created on Forest.
export function validateMongoConnectionUrl(value: string): boolean | string {
  return validateConnectionUrl(value, MONGO_URL_SCHEMES, 'mongodb://user:password@host:27017/db', {
    lowercaseOnly: true,
  });
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
  exclusive: ['databaseSslMode'],
  when: args => args.databaseSslMode === undefined,
  type: 'boolean',
  default: false,
  oclif: { description: 'Use SSL for database connection.' },
  prompter: { question: 'Does your database require a SSL connection?' },
};

export const databaseSslMode: Option = {
  exclusive: ['databaseSSL'],
  when: args => args.databaseSSL === undefined,
  choices: ['preferred', 'verify', 'required', 'disabled'].map(value => ({ name: value, value })),
  default: 'preferred',
  oclif: { description: 'SSL mode.' },
  prompter: { question: 'Which SSL mode do you want to use?' },
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
  when: args => ['postgres', 'mssql'].includes(getDialect(args)),
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
