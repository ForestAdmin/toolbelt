const jwt = require('jsonwebtoken');
const nock = require('nock');

const testDialog = require('./test-cli');
const LoginCommand = require('../../src/commands/login');

describe('login', () => {
  describe('with email in args', () => {
    describe('with bad token in args', () => {
      it('should display invalid token', () => testDialog({
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', 'invalid_token']),
        dialog: [
          { err: 'Invalid token. Please enter your authentication token.' },
        ],
      }));
    });
    describe('with valid token in args', () => {
      it('should login successful', () => testDialog({
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', jwt.sign({}, 'key', { expiresIn: '1day' })]),
        dialog: [
          { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
          { out: 'Login successful' },
        ],
      }));
    });
    describe('with a google mail', () => {
      describe('with a valid token from input', () => {
        it('should login successful', () => testDialog({
          env: { FOREST_URL: 'http://localhost:3001' },
          command: () => LoginCommand.run(['-e', 'robert@gmail.com']),
          nock: nock('http://localhost:3001')
            .get('/api/users/google/robert@gmail.com')
            .reply(200, { data: { isGoogleAccount: true } }),
          dialog: [
            {
              out: 'To authenticate with your Google account, please follow this link ' +
                'and copy the authentication token:',
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
        it('should login successful', () => testDialog({
          env: { FOREST_URL: 'http://localhost:3001' },
          command: () => LoginCommand.run([]),
          nock: nock('http://localhost:3001')
            .get('/api/users/google/robert@gmail.com')
            .reply(200, { data: { isGoogleAccount: true } }),
          dialog: [
            { out: 'What is your email address?' },
            { in: 'robert@gmail.com' },
            {
              out: 'To authenticate with your Google account, please follow this link ' +
                'and copy the authentication token:',
            },
            { in: `${jwt.sign({}, 'key', { expiresIn: '1day' })}` },
            { out: 'Login successful' },
          ],
        }));
      });
    });
    describe('with typing valid password', () => {
      it('should login successful', () => testDialog({
        env: { FOREST_URL: 'http://localhost:3001' },
        command: () => LoginCommand.run([]),
        nock: nock('http://localhost:3001')
          .post('/api/sessions', { email: 'some@mail.com', password: 'valid_pwd' })
          .reply(200),
        dialog: [
          { out: 'What is your email address?' },
          { in: 'some@mail.com' },
          { out: 'What is your Forest Admin password: [input is hidden] ?' },
          { in: 'valid_pwd' },
          { out: 'Login successful' },
        ],
      }));
    });
    describe('with typing wrong password', () => {
      it('should display incorrect password', () => testDialog({
        env: { FOREST_URL: 'http://localhost:3001' },
        command: () => LoginCommand.run([]),
        nock: nock('http://localhost:3001')
          .post('/api/sessions', { email: 'some@mail.com', password: 'pwd' })
          .reply(401),
        dialog: [
          { out: 'What is your email address?' },
          { in: 'some@mail.com' },
          { out: 'What is your Forest Admin password: [input is hidden] ?' },
          { in: 'pwd' },
          { err: 'Incorrect email or password.' },
        ],
      }));
    });

    describe('with typing wrong password2', () => {
      it('should display incorrect password', () => testDialog({
        env: { FOREST_URL: 'http://localhost:3001' },
        command: () => LoginCommand.run([]),
        nock: nock('http://localhost:3001')
          .post('/api/sessions', { email: 'some@mail.com', password: 'pwd' })
          .reply(401),
        dialog: [
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
