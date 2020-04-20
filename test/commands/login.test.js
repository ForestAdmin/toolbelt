const jwt = require('jsonwebtoken');

const testCli = require('./test-cli');
const LoginCommand = require('../../src/commands/login');
const {
  loginPasswordDialog,
} = require('../fixtures/std');

const {
  aGoogleAccount,
  loginValid,
  loginInvalid,
} = require('../fixtures/api');
const { testEnv } = require('../fixtures/env');

describe('login', () => {
  describe('with email in args', () => {
    describe('with bad token in args', () => {
      it('should display invalid token', () => testCli({
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', 'invalid_token']),
        std: [
          { err: 'Invalid token. Please enter your authentication token.' },
        ],
      }));
    });
    describe('with valid token in args', () => {
      const token = jwt.sign({}, 'key', { expiresIn: '1day' });
      it('should login successful', () => testCli({
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', token]),
        std: [
          { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
          { out: 'Login successful' },
        ],
      }));
    });
    describe('with a google mail', () => {
      describe('with a valid token from input', () => {
        it('should login successful', () => testCli({
          env: testEnv,
          api: aGoogleAccount(),
          command: () => LoginCommand.run(['-e', 'robert@gmail.com']),
          std: [
            {
              out: 'To authenticate with your Google account, please follow this link '
                + 'and copy the authentication token:',
            },
            { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
            { out: 'Login successful' },
          ],
        }));
      });
    });
  });

  describe('with typing email', () => {
    describe('with a google mail', () => {
      describe('with a valid token from input', () => {
        it('should login successful', () => testCli({
          env: testEnv,
          command: () => LoginCommand.run([]),
          api: aGoogleAccount(),
          std: [
            { out: 'What is your email address?' },
            { in: 'robert@gmail.com' },
            {
              out: 'To authenticate with your Google account, please follow this link '
                + 'and copy the authentication token:',
            },
            { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
            { out: 'Login successful' },
          ],
        }));
      });
    });
    describe('with typing valid password', () => {
      it('should login successful', () => testCli({
        env: testEnv,
        command: () => LoginCommand.run([]),
        api: loginValid(),
        std: [
          ...loginPasswordDialog,
        ],
      }));
    });
    describe('with typing wrong password', () => {
      it('should display incorrect password', () => testCli({
        env: testEnv,
        command: () => LoginCommand.run([]),
        api: loginInvalid(),
        std: [
          { out: 'What is your email address?' },
          { in: 'some@mail.com' },
          { out: 'What is your Forest Admin password: [input is hidden] ?' },
          { in: 'pwd' },
          { err: 'Incorrect email or password.' },
        ],
      }));
    });
  });
});
