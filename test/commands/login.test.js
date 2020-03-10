const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');
const jwt = require('jsonwebtoken');
const fancy = test.register('nock', Nock);

describe('login', () => {
  describe('with trivial mail and bad token in args', () => {
    fancy
      .stdout()
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', 'bad_token'])
      .it('should warn about bad token', (ctx) => {
        expect(ctx.stderr).to.contain('InvalidTokenError: Invalid token specified');
      });
  });

  describe('with trivial mail and valid token in args', () => {
    fancy
      .stdout()
      .stderr()
      .command(['login', '-e', 'smile@gmail.com', '-t', jwt.sign({}, 'key', { expiresIn: '1day' })])
      .it('should warn about bad token', (ctx) => {
        expect(ctx.stdout).to.contain('Login successful');
      });
  });
});

