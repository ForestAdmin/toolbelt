const jsonDiff = require('json-diff');
const testCli = require('../test-cli-helper/test-cli');
const DiffSchemaCommand = require('../../../src/commands/schema/diff');
const { testEnvWithSecret } = require('../../fixtures/env');
const {
  loginValidOidc, getEnvironmentApimap,
  getEnvironmentApimapForbidden,
} = require('../../fixtures/api');

describe('schema:diff', () => {
  describe('when the user is not logged in', () => {
    it('should login the user and does the diff', () => testCli({
      env: testEnvWithSecret,
      api: [
        () => loginValidOidc(),
        () => getEnvironmentApimap(10),
        () => getEnvironmentApimap(11),
      ],
      commandClass: DiffSchemaCommand,
      commandArgs: ['10', '11'],
      std: [
        { out: '> Login required.' },
        { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check?code=ABCD' },
        { out: 'Your confirmation code: USER-CODE' },
        { out: '> Login successful' },
        { out: '√ The schemas are identical.' },
      ],
    }));
  });

  describe('when the user is logged in', () => {
    describe('when schemas are identical', () => {
      it('display "identical" message', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getEnvironmentApimap(10),
          () => getEnvironmentApimap(11),
        ],
        commandClass: DiffSchemaCommand,
        commandArgs: ['10', '11'],
        std: [
          { out: '√ The schemas are identical.' },
        ],
      }));
    });

    describe('when schemas are not identical', () => {
      const apiMapA = { collections: [{ name: 'Users' }] };
      const apiMapB = { collections: [{ name: 'Users' }, { name: 'Posts' }] };

      it('display the diff message', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getEnvironmentApimap(10, apiMapA),
          () => getEnvironmentApimap(11, apiMapB),
        ],
        commandClass: DiffSchemaCommand,
        commandArgs: ['10', '11'],
        std: [
          { out: '⚠ The schemas have differences.' },
          { in: jsonDiff.diffString(apiMapA, apiMapB) },
        ],
      }));
    });

    describe('when there is an error', () => {
      it('should display an error message', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getEnvironmentApimap(10),
          () => getEnvironmentApimapForbidden(99999),
        ],
        commandClass: DiffSchemaCommand,
        commandArgs: ['10', '99999'],
        std: [
          { err: '× Cannot fetch the environments 10 and 99999.' },
          { err: '× Oops something went wrong.' },
        ],
      }));
    });
  });
});
