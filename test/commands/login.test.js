const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');

const fancy = test.register('nock', Nock);

describe('login', () => {
  fancy
    .stdout()
    .stderr()
    .env({ FOREST_URL: 'http://localhost:3001' })
    .nock('http://localhost:3001', (api) => api
      .get('/api/users/google/smile@gmail.com')
      .reply(200, { data: { isGoogleAccount: true } }))
    .command(['login', '-e', 'smile@gmail.com', '-P', 'secret'])
    .it('should login', (ctx) => {
      expect(ctx.stdout).to.contain('Invalid token. Please enter your authentication token.');
    });
});
