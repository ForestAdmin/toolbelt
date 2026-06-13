const testCli = require('./test-cli-helper/test-cli');
const SignupCommand = require('../../src/commands/signup');

const { signupValid, signupEmailTaken, signupWeakPassword } = require('../fixtures/api');
const { testEnvWithoutSecret } = require('../fixtures/env');

const allArgs = [
  '-e',
  'john@mail.com',
  '-P',
  'valid_pwd',
  '--first-name',
  'John',
  '--last-name',
  'Doe',
];

describe('signup', () => {
  describe('with all args provided', () => {
    it('should create the account and log in', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: SignupCommand,
        commandArgs: allArgs,
        api: () => signupValid(),
        std: [{ out: '> Account created. You are now logged in.' }],
      }));
  });

  describe('when the email is already in use (409)', () => {
    it('should relay the generic server message (no enumeration)', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: SignupCommand,
        commandArgs: allArgs,
        api: () => signupEmailTaken(),
        std: [{ err: '× Unable to create account. Please try again or contact support.' }],
      }));
  });

  describe('with an invalid email', () => {
    it('should fail validation before calling the API', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: SignupCommand,
        commandArgs: [
          '-e',
          'not-an-email',
          '-P',
          'Password123',
          '--first-name',
          'John',
          '--last-name',
          'Doe',
        ],
        std: [{ err: '× Invalid email' }],
      }));
  });

  describe('when the password is too weak (422)', () => {
    it('should surface the specific server message', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: SignupCommand,
        commandArgs: allArgs,
        api: () => signupWeakPassword(),
        std: [{ err: '× Your password security is too weak.' }],
      }));
  });
});
