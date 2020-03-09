const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');
const jwt = require('jsonwebtoken');
const fancy = test.register('nock', Nock);

describe('login', () => {
  describe('-e smile@gmail.com -t bad_token', () => {
    fancy
      .stdout()
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', 'bad_token'])
      .it('should warn about bad token', (ctx) => {
        expect(ctx.stderr).to.contain('InvalidTokenError: Invalid token specified');
      });
  });

  describe('-e smile@gmail.com -t valid_token', () => {
    fancy
      .stdout()
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', jwt.sign({}, 'key', { expiresIn: '1day' })])
      .it('should warn about bad token', (ctx) => {
        expect(ctx.stdout).to.contain('Login successful');
      });
  });

  describe('with a google mail', () => {
    fancy
      .stdout()
      .stderr()
      .env({ FOREST_URL: 'http://localhost:3001' })
      .nock('http://localhost:3001', (api) => api
        .get('/api/users/google/smile@gmail.com')
        .reply(200, { data: { isGoogleAccount: true } }))
      // .it('should ask the google token', (ctx) => {
      //   expect(ctx.stdout).to.contain('Login successful');
      // });
  });
});

/*

 */
