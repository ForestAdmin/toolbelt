import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Reading what an existing application is built with, to install the right packages when Forest is
 * mounted inside it (the "in-app" flows).
 *
 * Detection is deliberately silent and never blocking: it only picks a datasource package and a
 * mount helper. Whatever it gets wrong, the user still sees the snippet and can correct it — so a
 * wrong guess costs an edit, never a failed setup.
 */

export type NodeStack = {
  framework: 'express' | 'nestJs' | 'fastify' | 'koa';
  orm: 'sequelize' | 'mongoose' | 'typeorm' | 'prisma' | 'sql';
  typescript: boolean;
  /** The server is an ES module: `"type": "module"`, unless its entrypoint's extension says otherwise. */
  esm: boolean;
  /** False when there is no package.json at all — nothing was detected, we only have defaults. */
  detected: boolean;
};

/** The package of the SQL datasource, the one that needs a driver installed next to it. */
export const SQL_DATASOURCE = '@forestadmin/datasource-sql';

/**
 * The Forest datasource package matching each ORM. TypeORM and Prisma have no package of their
 * own on npm, so they get the SQL one, which introspects the database they sit on.
 */
export const NODE_DATASOURCE: Record<NodeStack['orm'], string> = {
  sequelize: '@forestadmin/datasource-sequelize',
  mongoose: '@forestadmin/datasource-mongoose',
  typeorm: SQL_DATASOURCE,
  prisma: SQL_DATASOURCE,
  sql: SQL_DATASOURCE,
};

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The driver Sequelize loads for each URL scheme. `@forestadmin/datasource-sql` ships none of them,
 * so an app without one crashes at boot with "Please install pg package manually". The versions
 * are the ones `create:sql` scaffolds.
 */
const SQL_DRIVERS: Record<string, { name: string; version: string }> = {
  postgres: { name: 'pg', version: '^8.8.0' },
  postgresql: { name: 'pg', version: '^8.8.0' },
  mysql: { name: 'mysql2', version: '^3.0.1' },
  mariadb: { name: 'mariadb', version: '^3.0.2' },
  mssql: { name: 'tedious', version: '^18.6.1' },
};

const KNOWN_SQL_DRIVERS = ['pg', 'mysql2', 'mariadb', 'tedious', 'sqlite3'];

/** For the messages: which package goes with which database. */
export const SQL_DRIVER_NAMES =
  'pg for Postgres, mysql2 for MySQL, mariadb, tedious for SQL Server';

export type SqlDriver =
  /** The app declares one already. */
  | { status: 'declared'; name: string }
  /** Read from the app's DATABASE_URL: `package` is what to install. */
  | { status: 'from-url'; name: string; package: string }
  /** Nothing to go on: the user has to install it. */
  | { status: 'unknown' };

/** The scheme of the app's DATABASE_URL, from its `.env` first — where Prisma keeps it — then the shell. */
function databaseUrlScheme(dir: string): string | undefined {
  let fromDotenv: string | undefined;
  try {
    fromDotenv = dotenv.parse(fs.readFileSync(path.join(dir, '.env'), 'utf8')).DATABASE_URL;
  } catch {
    // No .env: the shell may still export it.
  }

  return /^([a-z][a-z0-9+.-]*):\/\//i.exec(fromDotenv ?? process.env.DATABASE_URL ?? '')?.[1];
}

/** The SQL driver the app needs for `@forestadmin/datasource-sql`, and whether to install it. */
export function sqlDriver(dir = '.'): SqlDriver {
  const pkg = readJson(path.join(dir, 'package.json')) ?? {};
  const dependencies = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  const declared = KNOWN_SQL_DRIVERS.find(name =>
    Object.prototype.hasOwnProperty.call(dependencies, name),
  );
  if (declared) return { status: 'declared', name: declared };

  const driver = SQL_DRIVERS[databaseUrlScheme(dir)?.toLowerCase() ?? ''];

  return driver
    ? { status: 'from-url', name: driver.name, package: `${driver.name}@${driver.version}` }
    : { status: 'unknown' };
}

/**
 * Whether the app's server is an ES module. Node decides per file: `.mjs` is ESM and `.cjs` is
 * CommonJS whatever the package says, and only other files follow `"type"`. The file the snippet
 * goes into is not known, so the entrypoint `scripts.start` or `main` names stands in for it.
 */
function isEsm(pkg: Record<string, unknown>): boolean {
  const start = (pkg.scripts as Record<string, string> | undefined)?.start ?? '';
  const entry =
    /[^\s'"]+\.[cm]?[jt]s\b/.exec(start)?.[0] ?? (typeof pkg.main === 'string' ? pkg.main : '');

  if (/\.m[jt]s$/.test(entry)) return true;
  if (/\.c[jt]s$/.test(entry)) return false;

  return pkg.type === 'module';
}

/** Guess a Node application's framework and ORM from its declared dependencies. */
export function detectNodeStack(dir = '.'): NodeStack {
  const pkg = readJson(path.join(dir, 'package.json')) ?? {};
  const dependencies = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  const has = (name: string) => Object.prototype.hasOwnProperty.call(dependencies, name);

  // Ordered by specificity: a NestJS app also depends on express, and a Prisma one often keeps a
  // raw SQL driver around, so the most specific match has to win.
  const framework = (
    [
      ['@nestjs/core', 'nestJs'],
      ['fastify', 'fastify'],
      ['koa', 'koa'],
    ] as const
  ).find(([dependency]) => has(dependency))?.[1];

  const orm = (
    [
      ['sequelize', 'sequelize'],
      ['mongoose', 'mongoose'],
      ['typeorm', 'typeorm'],
      ['@prisma/client', 'prisma'],
      ['prisma', 'prisma'],
    ] as const
  ).find(([dependency]) => has(dependency))?.[1];

  return {
    framework: framework ?? 'express',
    orm: orm ?? 'sql',
    typescript: has('typescript') || fs.existsSync(path.join(dir, 'tsconfig.json')),
    esm: isEsm(pkg),
    detected: Boolean(pkg.name),
  };
}

/** True when the current directory holds a Rails application. */
export function detectRails(): boolean {
  try {
    // Anchored per line and excluding comments: `# gem 'rails'` is how a Gemfile records that
    // Rails was considered and NOT used, so matching it sends a Node repo down the Rails flow —
    // installing Rails gems and calling `bin/rails` in a project that has neither.
    return /^(?!\s*#).*gem\s+['"]rails['"]/m.test(fs.readFileSync('Gemfile', 'utf8'));
  } catch {
    return false;
  }
}

/** The mount helper name for a framework — `mountOnNestJs`, `mountOnExpress`, … */
export function mountHelper(framework: NodeStack['framework']): string {
  return framework === 'nestJs' ? 'NestJs' : framework.charAt(0).toUpperCase() + framework.slice(1);
}
