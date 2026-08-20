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

/** The Forest datasource package matching each ORM. */
export const NODE_DATASOURCE: Record<NodeStack['orm'], string> = {
  sequelize: '@forestadmin/datasource-sequelize',
  mongoose: '@forestadmin/datasource-mongoose',
  typeorm: '@forestadmin/datasource-typeorm',
  prisma: '@forestadmin/datasource-prisma',
  sql: '@forestadmin/datasource-sql',
};

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
