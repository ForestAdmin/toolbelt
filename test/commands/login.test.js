const jwt = require('jsonwebtoken');

const testCli = require('./test-cli');
const LoginCommand = require('../../src/commands/login');

const {
  loginValid,
  loginInvalid,
  loginInvalidOidc,
  loginValidOidc,
} = require('../fixtures/api');
const { testEnv } = require('../fixtures/env');

describe('login', () => {
  describe('with email in args', () => {
    describe('with bad token in args', () => {
      it('should display invalid token', () => testCli({
        commandClass: LoginCommand,
        commandArgs: ['-e', 'smile@gmail.com', '-t', 'invalid_token'],
        std: [
          { err: 'Invalid token. Please enter your authentication token.' },
        ],
      }));
    });
    describe('with valid token in args', () => {
      it('should login successful', () => testCli({
        env: testEnv,
        commandClass: LoginCommand,
        commandArgs: [
          '-e', 'smile@gmail.com',
          '-t', jwt.sign({}, 'key', { expiresIn: '1day' }),
        ],
        std: [
          { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
          { out: 'Login successful' },
        ],
      }));
    });

    describe('with a valid password in args', () => {
      it('should login successfully', () => testCli({
        commandClass: LoginCommand,
        commandArgs: ['-e', 'some@mail.com', '-P', 'valid_pwd'],
        env: testEnv,
        api: () => loginValid(),
        std: [
          { out: 'Login successful' },
        ],
      }));
    });

    describe('with an invalid password in args', () => {
      it('should display incorrect password', () => testCli({
        env: testEnv,
        commandClass: LoginCommand,
        commandArgs: ['-e', 'some@mail.com', '-P', 'pwd'],
        api: () => loginInvalid(),
        std: [
          { err: 'Incorrect email or password.' },
        ],
      }));
    });
  });

  describe('with the oidc authentication', () => {
    describe('with a successful oidc authentication', () => {
      it('should login successful', () => testCli({
        env: testEnv,
        commandClass: LoginCommand,
        api: () => loginValidOidc(),
        std: [
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
          { out: 'Login successful' },
        ],
      }));
    });

    describe('with an failed oidc authentication', () => {
      it('should display the error message', () => testCli({
        env: testEnv,
        commandClass: LoginCommand,
        api: () => loginInvalidOidc(),
        std: [
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
          { err: 'Error during the authentication: The authentication failed.' },
        ],
      }));
    });
  });
});
