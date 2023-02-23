/* eslint-disable global-require */
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
        const FOREST_URL = process.env.FOREST_URL || DEFAULT_FOREST_URL;
        const FOREST_URL_IS_DEFAULT = FOREST_URL === DEFAULT_FOREST_URL;
        return {
          DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
          DATABASE_URL: process.env.DATABASE_URL,
          FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
          FOREST_URL,
          FOREST_URL_IS_DEFAULT,
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
