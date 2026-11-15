import fs from 'fs';

export const RAILS_INITIALIZER = 'config/initializers/forest_admin_rails.rb';

const SAFE_SERVER_URL = /^https?:\/\/[^\s'\\]+$/;
const CONFIGURE_LINE = /^[ \t]*ForestAdminRails\.configure do \|config\|[ \t]*\r?\n/m;
const RAILS_DEVELOPMENT_DOTENVS = ['.env.development.local', '.env.local', '.env.development'];
const DOTENV_SERVER_URL =
  /^[ \t]*(?:export[ \t]+)?FOREST_SERVER_URL[ \t]*=[ \t]*(['"]?)(.*?)\1[ \t]*(?:#.*)?\r?$/m;

/** The first `FOREST_SERVER_URL` dotenv-rails would load in development, `.env` aside: the CLI reads that one. */
export function railsDotenvServerUrl(): { file: string; url: string } | undefined {
  return RAILS_DEVELOPMENT_DOTENVS.filter(file => fs.existsSync(file))
    .map(file => ({ file, match: DOTENV_SERVER_URL.exec(fs.readFileSync(file, 'utf8')) }))
    .filter(({ match }) => match)
    .map(({ file, match }) => ({ file, url: match[2] }))[0];
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

  const line = `  ${serverUrlLine(url)}\n`;
  const mentions = content.split('forest_server_url').length - 1;
  if (mentions === 1 && content.includes(`\n${line}`)) return true;
  if (mentions > 0 || !CONFIGURE_LINE.test(content)) return false;

  fs.writeFileSync(
    RAILS_INITIALIZER,
    content.replace(CONFIGURE_LINE, block => `${block}${line}`),
  );

  return true;
}
