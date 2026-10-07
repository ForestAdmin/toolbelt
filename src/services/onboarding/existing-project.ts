import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Forest projects already on this machine, so `forest start` can reopen one instead of creating
 * another: run again after a retry, or after leaving its menu, it otherwise only knew how to start
 * from scratch.
 *
 * Local only, on purpose: a folder holds everything a boot needs. Reopening a project from the
 * account alone would mean scaffolding it again and fetching its secrets.
 */

export type ExistingProject = {
  /** Where it lives, relative to the current folder: `.` or a subfolder. */
  dir: string;
  /**
   * How it boots. `scaffold` is what `forest start` / `projects:create:*` generated: its own
   * standalone server. The two apps are the user's own, Forest mounted inside.
   */
  kind: 'scaffold' | 'node-app' | 'rails-app';
  /** Sample data rather than the user's database. */
  demo: boolean;
  /**
   * For a Node app: whether its code mounts Forest. In-app onboarding installs the agent and writes
   * the secrets before the user pastes the mount, so an interrupted one looks reopenable but would
   * boot an app with no Forest in it.
   */
  mounted?: boolean;
  envSecret: string;
};

function read(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function envSecretFromDotenv(dir: string): string | undefined {
  const dotenvFile = read(path.join(dir, '.env'));

  return (dotenvFile && dotenv.parse(dotenvFile).FOREST_ENV_SECRET) || undefined;
}

/** `forest_admin_rails`'s generator writes the secret into its initializer, not into `.env`. */
function envSecretFromRailsInitializer(dir: string): string | undefined {
  const initializer = read(path.join(dir, 'config/initializers/forest_admin_rails.rb'));
  if (!initializer) return undefined;

  // Active lines only: a commented-out assignment is often an older secret left above the real one.
  return (
    /^[ \t]*(?:config\.)?env_secret\s*=\s*['"]([^'"]+)['"]/m.exec(initializer)?.[1] ??
    // `config.env_secret = ENV['FOREST_ENV_SECRET']`: then it is in `.env` after all.
    (/^[ \t]*(?:config\.)?env_secret\s*=\s*ENV\[['"]FOREST_ENV_SECRET['"]\]/m.test(initializer)
      ? envSecretFromDotenv(dir)
      : undefined)
  );
}

const SOURCE = /\.[cm]?[jt]s$/;
const NOT_SOURCES = new Set(['node_modules', 'dist', 'build', 'coverage', 'out']);
const MAX_FILES = 500;

function entriesOf(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** The app's own source files, breadth first and bounded: never its dependencies or builds. */
function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  const folders = [dir];

  while (folders.length && files.length < MAX_FILES) {
    const folder = folders.shift() as string;
    entriesOf(folder)
      .filter(entry => !entry.name.startsWith('.'))
      .forEach(entry => {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory() && !NOT_SOURCES.has(entry.name)) folders.push(file);
        else if (entry.isFile() && SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          files.push(file);
        }
      });
  }

  return files.slice(0, MAX_FILES);
}

/** Whether the app's own code loads the agent and mounts it: the mount can live in any file. */
function mountsForest(dir: string): boolean {
  return sourceFiles(dir).some(file => {
    const source = read(file) ?? '';

    return source.includes('@forestadmin/agent') && /\.mountOn[A-Z]\w*\(/.test(source);
  });
}

/** The Forest project `dir` holds, or null when it holds none. */
export function findForestProject(dir: string): ExistingProject | null {
  const railsSecret = envSecretFromRailsInitializer(dir);
  if (railsSecret) return { dir, kind: 'rails-app', demo: false, envSecret: railsSecret };

  const envSecret = envSecretFromDotenv(dir);
  const packageJson = read(path.join(dir, 'package.json'));
  if (!envSecret || !packageJson) return null;

  let dependencies: Record<string, string> = {};
  try {
    dependencies = JSON.parse(packageJson).dependencies ?? {};
  } catch {
    return null;
  }
  if (!dependencies['@forestadmin/agent']) return null;

  // A scaffold boots its own server; an app mounts the agent on its framework.
  const entry = ['index.ts', 'index.js'].map(file => read(path.join(dir, file))).find(Boolean);
  const scaffold = Boolean(entry?.includes('mountOnStandaloneServer'));

  if (scaffold) {
    return {
      dir,
      kind: 'scaffold',
      demo: Boolean(dependencies['@forestadmin/datasource-demo-fintech']),
      envSecret,
    };
  }

  return { dir, kind: 'node-app', demo: false, envSecret, mounted: mountsForest(dir) };
}

/** The Forest projects in the immediate subfolders of `dir`, sorted by name. */
export function findForestProjectsIn(dir: string): ExistingProject[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter(entry => entry.name !== 'node_modules')
    .map(entry => findForestProject(path.join(dir, entry.name)))
    .filter((project): project is ExistingProject => project !== null)
    .map(project => ({ ...project, dir: path.relative(dir, project.dir) || '.' }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}
