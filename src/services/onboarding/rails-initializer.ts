import fs from 'fs';

export const RAILS_INITIALIZER = 'config/initializers/forest_admin_rails.rb';

const SAFE_SERVER_URL = /^https?:\/\/[^\s'\\]+$/;
const CONFIGURE_LINE = /^[ \t]*ForestAdminRails\.configure do \|config\|[ \t]*\r?\n/m;
const SIMPLE_ASSIGNMENT =
  /^[ \t]*config\.forest_server_url = (?:ENV\.fetch\('FOREST_SERVER_URL', '[^'\\\n]*'\)|'[^'\\\n]*')[ \t]*\r?\n/m;

/** Written into Ruby source between single quotes, so nothing in it may end the string or the line. */
export const isSafeServerUrl = (url: string) => SAFE_SERVER_URL.test(url);

/** The deploy's own `FOREST_SERVER_URL` keeps the last word, as it does for the gem's default. */
export function serverUrlLine(url: string): string {
  return `config.forest_server_url = ENV.fetch('FOREST_SERVER_URL', '${url}')`;
}

/**
 * Points the generated `forest_admin_rails` initializer at a safe `url`. Returns false, writing
 * nothing, unless the file sets no server yet or sets it on one simple line.
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
  let pinned: string;
  if (mentions === 0 && CONFIGURE_LINE.test(content)) {
    pinned = content.replace(CONFIGURE_LINE, block => `${block}${line}`);
  } else if (mentions === 1 && SIMPLE_ASSIGNMENT.test(content)) {
    pinned = content.replace(SIMPLE_ASSIGNMENT, () => line);
  } else {
    return false;
  }

  fs.writeFileSync(RAILS_INITIALIZER, pinned);

  return true;
}
