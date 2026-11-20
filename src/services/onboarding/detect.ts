import fs from 'fs';

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
  /** False when there is no package.json at all — nothing was detected, we only have defaults. */
  detected: boolean;
};

/**
 * The Forest datasource package matching each ORM. TypeORM and Prisma have no package of their
 * own on npm, so they get the SQL one, which introspects the database they sit on.
 */
export const NODE_DATASOURCE: Record<NodeStack['orm'], string> = {
  sequelize: '@forestadmin/datasource-sequelize',
  mongoose: '@forestadmin/datasource-mongoose',
  typeorm: '@forestadmin/datasource-sql',
  prisma: '@forestadmin/datasource-sql',
  sql: '@forestadmin/datasource-sql',
};

export const NODE_SERVER_URL_OPTION = 'forestServerUrl: process.env.FOREST_SERVER_URL';

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Guess a Node application's framework and ORM from its declared dependencies. */
export function detectNodeStack(): NodeStack {
  const pkg = readJson('package.json') ?? {};
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
    typescript: has('typescript') || fs.existsSync('tsconfig.json'),
    detected: Boolean(pkg.name),
  };
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function declaresGem(name: 'rails' | 'json'): boolean {
  return new RegExp(`^(?!\\s*#).*gem[\\s(]+['"]${name}['"]`, 'm').test(readText('Gemfile'));
}

/** True when the current directory holds a Rails application. */
export function detectRails(): boolean {
  // Anchored per line and excluding comments: `# gem 'rails'` is how a Gemfile records that
  // Rails was considered and NOT used, so matching it sends a Node repo down the Rails flow —
  // installing Rails gems and calling `bin/rails` in a project that has neither.
  return declaresGem('rails');
}

type Version = [number, number, number];

function lockedVersion(gem: 'activesupport' | 'json'): Version | undefined {
  const version = new RegExp(`^ {4}${gem} \\((\\d+)\\.(\\d+)\\.(\\d+)`, 'm').exec(
    readText('Gemfile.lock'),
  );

  return version ? [Number(version[1]), Number(version[2]), Number(version[3])] : undefined;
}

function activeSupportPassesQuirksMode([major, minor, patch]: Version): boolean {
  if (major === 8) return minor === 0;

  return major < 7 || (major === 7 && (minor < 2 || (minor === 2 && patch < 4)));
}

export function needsJsonBelow3(): boolean {
  const activeSupport = lockedVersion('activesupport');
  const json = lockedVersion('json');

  return (
    activeSupport !== undefined &&
    activeSupportPassesQuirksMode(activeSupport) &&
    (json === undefined || json[0] >= 3) &&
    !declaresGem('json')
  );
}

/** The mount helper name for a framework — `mountOnNestJs`, `mountOnExpress`, … */
export function mountHelper(framework: NodeStack['framework']): string {
  return framework === 'nestJs' ? 'NestJs' : framework.charAt(0).toUpperCase() + framework.slice(1);
}
