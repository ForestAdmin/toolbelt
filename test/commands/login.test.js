const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');
const jwt = require('jsonwebtoken');

const input = (value, delay = 0) => {
  let stdin;
  return {
    run: () => {
      stdin = require('mock-stdin').stdin();
      setTimeout(() => {
        stdin.send(value);
        stdin.end();
      }, delay);
    },
  };
};

const fancy = test
  .register('nock', Nock)
  .register('input', input);

describe('login', () => {
  describe('with trivial mail and bad token in args', () => {
    fancy
      .stdout({ print: true })
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', 'bad_token'])
      .it('should warn about bad token', (ctx) => {
        expect(ctx.stderr).to.contain('Invalid token. Please enter your authentication token.');
      });
  });

  describe('with trivial mail and valid token in args', () => {
    fancy
      .stdout()
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', jwt.sign({}, 'key', { expiresIn: '1day' })])
      .it('should display "Login successful"', (ctx) => {
        expect(ctx.stdout).to.contain('Login successful');
      });
  });

  describe('stdin test', () => {
    fancy
      .stdin('token')
      .it('should contain data equals "token"', () => {
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', (data) => {
          expect(data).to.equals('token');
        });
      });
  });

  // describe('with a google mail and a valid token', () => {
  //   fancy
  //     .stdout({ print: true })
  //     .env({ FOREST_URL: 'http://localhost:3001' })
  //     .nock('http://localhost:3001', (api) => api
  //       .get('/api/users/google/robert@gmail.com')
  //       .reply(200, { data: { isGoogleAccount: true } }))
  //     .input(jwt.sign({}, 'key', { expiresIn: '1day' }), 500)
  //     .command(['login', '-e', 'robert@gmail.com'])
  //     .it('should display Login successful', (ctx) => {
  //       console.log("hello")
  //       return expect(ctx.stdout).to.contain('Login successful')
  //     });
  // });

  // describe('with a google mail and a invalid token', () => {
  //   fancy
  //     .env({ FOREST_URL: 'http://localhost:3001' })
  //     .nock('http://localhost:3001', (api) => api
  //       .get('/api/users/google/robert@gmail.com')
  //       .reply(200, { data: { isGoogleAccount: true } }))
  //     .input('invalid token\n', 500)
  //     .command(['login', '-e', 'robert@gmail.com'])
  //     .it('should display InvalidTokenError', (ctx) =>
  //       expect(ctx.stdout).to.contain('InvalidTokenError: Invalid token specified'),
  //     );
  // });
});
