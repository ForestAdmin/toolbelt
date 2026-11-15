import fs from 'fs';

export const RAILS_INITIALIZER = 'config/initializers/forest_admin_rails.rb';

const CONFIGURE_BLOCK = /^[ \t]*ForestAdminRails\.configure do \|config\|[^\n]*\n/m;
const SERVER_URL_ASSIGNMENT = /^[ \t]*config\.forest_server_url[ \t]*=[^\n]*\n/m;

const rubyString = (value: string) => `'${value.replace(/[\\']/g, '\\$&')}'`;

/** The deploy's own `FOREST_SERVER_URL` keeps the last word: this file is committed and also loads in production. */
export function serverUrlLine(url: string): string {
  return `config.forest_server_url = ENV.fetch('FOREST_SERVER_URL', ${rubyString(url)})`;
}

/** Points the generated `forest_admin_rails` initializer at `url`. Returns false when it cannot. */
export function pinServerUrl(url: string): boolean {
  let content: string;
  try {
    content = fs.readFileSync(RAILS_INITIALIZER, 'utf8');
  } catch {
    return false;
  }

  const line = `  ${serverUrlLine(url)}\n`;
  let pinned: string;
  if (SERVER_URL_ASSIGNMENT.test(content))
    pinned = content.replace(SERVER_URL_ASSIGNMENT, () => line);
  else if (CONFIGURE_BLOCK.test(content))
    pinned = content.replace(CONFIGURE_BLOCK, block => `${block}${line}`);
  else return false;

  fs.writeFileSync(RAILS_INITIALIZER, pinned);

  return true;
}
