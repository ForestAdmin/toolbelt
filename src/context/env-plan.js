/* eslint-disable global-require */
function resolveForestAppUrl(appUrl, apiUrl) {
  const configuredUrl = appUrl || apiUrl;
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    if (appUrl) return url.origin;
    if (!/^api\.[a-z0-9-]+\.forestadmin\.com$/.test(url.hostname)) return undefined;

    url.hostname = url.hostname.replace(/^api\./, 'app.');
    return url.origin;
  } catch {
    return undefined;
  }
}

module.exports = plan =>
  plan
    .addPackage('dotenv', planDotenv =>
      planDotenv
        .addModule('dotenv', () => require('dotenv'), { private: true })
        .with('dotenv', dotenv => dotenv.config()),
    )
    .addValue('constants', {
      CURRENT_WORKING_DIRECTORY: process.cwd(),
    })
    .addPackage('variables', planVariables =>
      planVariables.addUsingFunction('env', ({ assertPresent, os }) => {
        assertPresent({ os });
        const DEFAULT_FOREST_URL = 'https://api.forestadmin.com';
        const FOREST_SERVER_URL_SOURCE = ['FOREST_URL', 'FOREST_SERVER_URL'].find(
          name => process.env[name],
        );
        const FOREST_SERVER_URL = FOREST_SERVER_URL_SOURCE
          ? process.env[FOREST_SERVER_URL_SOURCE]
          : DEFAULT_FOREST_URL;
        const FOREST_URL_IS_DEFAULT = FOREST_SERVER_URL === DEFAULT_FOREST_URL;
        return {
          DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
          DATABASE_URL: process.env.DATABASE_URL,
          FOREST_APP_URL: resolveForestAppUrl(process.env.FOREST_APP_URL, process.env.FOREST_URL),
          FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
          FOREST_SERVER_URL,
          FOREST_SERVER_URL_SOURCE,
          FOREST_URL_IS_DEFAULT,
          RAILS_ENV: process.env.RAILS_ENV || process.env.RACK_ENV,
          RAW_FOREST_SERVER_URL: process.env.FOREST_SERVER_URL,
          SILENT: process.env.SILENT,
          TOKEN_PATH: process.env.TOKEN_PATH || os.homedir(),
        };
      }),
    )
    .addPackage('others', planOthers =>
      planOthers.addValue('process', process).addModule('pkg', () => require('../../package.json')),
    )
    .addValue('isLinuxOs', ({ assertPresent, os }) => {
      assertPresent({ os });
      return os.platform() === 'linux';
    });
