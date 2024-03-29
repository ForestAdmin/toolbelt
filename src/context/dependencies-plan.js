/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addPackage('open', planOpen => planOpen.addUsingFunction('open', () => require('open')))
    .addPackage('std', planStd =>
      planStd
        .addUsingFunction('stdout', () => process.stdout)
        .addUsingFunction('stderr', () => process.stderr),
    )
    .addPackage('inquirer', planInquirer =>
      planInquirer.addInstance('inquirer', () => require('inquirer')),
    )
    .addPackage('jwtDecode', planJWTDecode =>
      planJWTDecode.addInstance('jwtDecode', () => require('jwt-decode')),
    )
    .addPackage('others', planOthers =>
      planOthers
        .addModule('mkdirp', () => require('mkdirp'))
        .addInstance('Table', () => require('cli-table'))
        .addModule('chalk', () => require('chalk'))
        .addModule('crypto', () => require('crypto'))
        .addModule('fs', () => require('fs'))
        .addModule('joi', () => require('joi'))
        .addModule('openIdClient', () => require('openid-client'))
        .addModule('os', () => require('os'))
        .addModule('superagent', () => require('superagent'))
        .addUsingFunction('diffString', () => require('json-diff').diffString)
        .addModule('lodash', () => require('lodash')),
    );
