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
  /** The server is an ES module: `"type": "module"`, unless its entrypoint's extension says otherwise. */
  esm: boolean;
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

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
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
