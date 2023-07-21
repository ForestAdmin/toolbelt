const testCli = require('./test-cli-helper/test-cli');
const EnvironmentCommand = require('../../src/commands/environments');
const { testEnvWithoutSecret } = require('../fixtures/env');
const {
  getProjectListValid,
  getEnvironmentListValid,
  loginValidOidc,
  getEnvironmentListWithoutApiEndpoint,
} = require('../fixtures/api');

describe('environments', () => {
  it('should display environment list', () =>
    testCli({
      env: testEnvWithoutSecret,
      commandClass: EnvironmentCommand,
      api: [() => loginValidOidc(), () => getProjectListValid(), () => getEnvironmentListValid()],
      prompts: [
        {
          in: [
            {
              name: 'project',
              message: 'Select your project',
              type: 'list',
              choices: [
                { name: 'project1', value: 1 },
                { name: 'project2', value: 2 },
              ],
            },
          ],
          out: { project: 2 },
        },
      ],
      std: [
        { out: '> Login required.' },
        {
          out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check',
        },
        { out: 'Your confirmation code: USER-CODE' },
        { out: '> Login successful' },
        { out: 'ENVIRONMENTS' },
        { out: 'ID        NAME                URL                                TYPE' },
        { out: '3         name1               http://localhost:1                 remote' },
        { out: '4         name2               http://localhost:2                 production' },
        { out: '5         test                http://localhost:3                 test' },
      ],
    }));

  describe('when apiEndpoint is null because the onboarding is not finished', () => {
    it('should display environment list', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: EnvironmentCommand,
        api: [
          () => loginValidOidc(),
          () => getProjectListValid(),
          () => getEnvironmentListWithoutApiEndpoint(),
        ],
        prompts: [
          {
            in: [
              {
                name: 'project',
                message: 'Select your project',
                type: 'list',
                choices: [
                  { name: 'project1', value: 1 },
                  { name: 'project2', value: 2 },
                ],
              },
            ],
            out: { project: 2 },
          },
        ],
        std: [
          { out: '> Login required.' },
          {
            out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check',
          },
          { out: 'Your confirmation code: USER-CODE' },
          { out: '> Login successful' },
          { out: 'ENVIRONMENTS' },
          { out: 'ID        NAME                URL                                TYPE' },
          { out: '3         name1                                                  remote' },
        ],
      }));
  });
});
