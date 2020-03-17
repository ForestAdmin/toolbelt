const jwt = require('jsonwebtoken');
const nock = require('nock');

const testCli = require('./test-cli');
const LoginCommand = require('../../src/commands/login');

describe('login', () => {
  describe('with email in args', () => {
    describe('with bad token in args', () => {
      it('should display invalid token', () => testCli({
        inputs: [
          `${jwt.sign({}, 'key', { expiresIn: '1day' })}\n`,
        ],
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', 'bad_token']),
        errorOutputs: [
          'Invalid token. Please enter your authentication token.',
        ],
      }));
    });
    describe('with valid token in args', () => {
      it('should login successful', () => testCli({
        inputs: [
          `${jwt.sign({}, 'key', { expiresIn: '1day' })}\n`,
        ],
        command: () => LoginCommand.run(['-e', 'smile@gmail.com', '-t', jwt.sign({}, 'key', { expiresIn: '1day' })]),
        outputs: [
          'Login successful',
        ],
      }));
    });
    describe('with a google mail', () => {
      describe('with a valid token from input', () => {
        it('should login successful', () => testCli({
          env: { FOREST_URL: 'http://localhost:3001' },
          nock: nock('http://localhost:3001')
            .get('/api/users/google/robert@gmail.com')
            .reply(200, { data: { isGoogleAccount: true } }),
          inputs: [
            `${jwt.sign({}, 'key', { expiresIn: '1day' })}\n`,
          ],
          command: () => LoginCommand.run(['-e', 'robert@gmail.com']),
          outputs: [
            'Login successful',
          ],
        }));
      });
    });
  });

  describe('with typing email', () => {
    describe('with a google mail', () => {
      describe('with a valid token from input', () => {
        it('should login successful', () => testCli({
          env: { FOREST_URL: 'http://localhost:3001' },
          nock: nock('http://localhost:3001')
            .get('/api/users/google/robert@gmail.com')
            .reply(200, { data: { isGoogleAccount: true } }),
          inputs: [
            'robert@gmail.com\n',
            `${jwt.sign({}, 'key', { expiresIn: '1day' })}\n`,
          ],
          command: () => LoginCommand.run([]),
          outputs: [
            'Login successful',
          ],
        }));
      });
    });
    describe('with typing valid password', () => {
      it('should login successful', () => testCli({
        env: { FOREST_URL: 'http://localhost:3001' },
        nock: nock('http://localhost:3001')
          .post('/api/sessions', { email: 'some@mail.com', password: 'pwd' })
          .reply(200),
        inputs: [
          'some@mail.com\n',
          'pwd\n',
        ],
        command: () => LoginCommand.run([]),
        outputs: [
          'What is your email address? some@mail.com',
          'What is your Forest Admin password: [input is hidden] ?',
          'Login successful',
        ],
      }));
    });
    describe('with typing wrong password', () => {
      it('should display incorrect password', () => testCli({
        env: { FOREST_URL: 'http://localhost:3001' },
        nock: nock('http://localhost:3001')
          .post('/api/sessions', { email: 'some@mail.com', password: 'pwd' })
          .reply(401),
        inputs: [
          'some@mail.com\n',
          'pwd\n',
        ],
        command: () => LoginCommand.run([]),
        outputs: [
          'What is your email address? some@mail.com',
          'What is your Forest Admin password: [input is hidden] ?',
        ],
        errorOutputs: [
          'Incorrect email or password.',
        ],
      }));
    });
  });
});
