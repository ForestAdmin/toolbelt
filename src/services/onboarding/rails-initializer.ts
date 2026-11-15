import fs from 'fs';

export const RAILS_INITIALIZER = 'config/initializers/forest_admin_rails.rb';

const SAFE_SERVER_URL = /^https?:\/\/[^\s'\\]+$/;
const CONFIGURE_LINE = /^[ \t]*ForestAdminRails\.configure do \|config\|[ \t]*\r?\n/m;
const DOTENV_SERVER_URL =
  /^[ \t]*(?:export[ \t]+)?FOREST_SERVER_URL(?:[ \t]*=|:[ \t])[ \t]*(['"]?)(.*?)\1[ \t]*(?:#.*)?\r?$/gm;

export type RailsServerUrlEnv = {
  FOREST_SERVER_URL?: string;
  FOREST_SERVER_URL_SOURCE?: string;
  RAILS_ENV?: string;
  RAW_FOREST_SERVER_URL?: string;
};

function railsDotenvFiles(railsEnv: string): string[] {
  return [
    `.env.${railsEnv}.local`,
    ...(railsEnv === 'test' ? [] : ['.env.local']),
    `.env.${railsEnv}`,
    '.env',
  ];
}

/**
 * The `FOREST_SERVER_URL` dotenv-rails would load for `railsEnv`, in its load order: the first file
 * that sets it wins, and within a file its last assignment. `.env` counts too, since the CLI's dotenv
 * skips the `export` lines and never overrides the shell, where Ruby dotenv reads them on a restart.
 */
export function railsDotenvServerUrl(
  railsEnv = 'development',
): { file: string; url: string } | undefined {
  return railsDotenvFiles(railsEnv)
    .filter(file => fs.existsSync(file))
    .map(file => ({
      file,
      matches: [...fs.readFileSync(file, 'utf8').matchAll(DOTENV_SERVER_URL)],
    }))
    .filter(({ matches }) => matches.length > 0)
    .map(({ file, matches }) => ({ file, url: matches[matches.length - 1][2] }))[0];
}

/** Written into Ruby source between single quotes, so nothing in it may end the string or the line. */
export const isSafeServerUrl = (url: string) => SAFE_SERVER_URL.test(url);

/** This file is committed: production keeps the gem's default, and a set `FOREST_SERVER_URL` always wins. */
export function serverUrlLine(url: string): string {
  return `config.forest_server_url = ENV.fetch('FOREST_SERVER_URL', '${url}') unless Rails.env.production?`;
}

/**
 * Points the generated `forest_admin_rails` initializer at a safe `url`. Never rewrites a server the
 * file already sets: returns false, writing nothing, unless that is this very line.
 */
export function pinServerUrl(url: string): boolean {
  let content: string;
  try {
    content = fs.readFileSync(RAILS_INITIALIZER, 'utf8');
  } catch {
    return false;
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const line = `  ${serverUrlLine(url)}${eol}`;
  const mentions = content.split('forest_server_url').length - 1;
  if (mentions === 1 && content.includes(`${eol}${line}`)) return true;
  if (mentions > 0 || !CONFIGURE_LINE.test(content)) return false;

  fs.writeFileSync(
    RAILS_INITIALIZER,
    content.replace(CONFIGURE_LINE, block => `${block}${line}`),
  );

  return true;
}

/** Checked before anything is created: the URL ends up inside the user's Ruby source. */
export function checkRailsServerUrl(env: RailsServerUrlEnv): string | undefined {
  const { FOREST_SERVER_URL: url, FOREST_SERVER_URL_SOURCE: source } = env;
  const rawUrl = env.RAW_FOREST_SERVER_URL;
  if (rawUrl !== undefined && rawUrl !== url) {
    throw new Error(
      `FOREST_SERVER_URL=${rawUrl} would send a later \`bin/rails server\` to another server ` +
        `than FOREST_URL=${url}. Unset it, or set it to the same URL.`,
    );
  }

  const dotenv = railsDotenvServerUrl(env.RAILS_ENV);
  if (dotenv && dotenv.url !== url) {
    throw new Error(
      `${dotenv.file} sets FOREST_SERVER_URL=${dotenv.url}, which would send a later ` +
        `\`bin/rails server\` to another server than ${url}. Remove that line, or set it to the same URL.`,
    );
  }

  if (url && !isSafeServerUrl(url)) {
    throw new Error(
      `${source} must be an http(s) URL with no quote, backslash or whitespace: ${JSON.stringify(
        url,
      )}`,
    );
  }

  return url;
}
