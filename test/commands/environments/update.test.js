const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');

const fancy = test.register('nock', Nock);
const authenticator = require('../../../src/services/authenticator');

describe('environments:update', () => {
  let getAuthToken;
  before(() => {
    getAuthToken = authenticator.getAuthToken;
    authenticator.getAuthToken = () => 'token';
  });
  after(() => {
    authenticator.getAuthToken = getAuthToken;
  });

  describe('with a valid token, environment id and name', () =>
    fancy
      .stdout({ print: true })
      .env({ FOREST_URL: 'http://localhost:3001' })
      .nock('http://localhost:3001', (api) => api
        .put('/api/environments/182', '{"data":{"type":"environments","attributes":{"name":"NewName"}}}')
        .reply(200))
      .command(['environments:update', '-e', '182', '-n', 'NewName'])
      .it('should stdout "Environment updated"', (ctx) => {
        expect(ctx.stdout).to.contain('Environment updated');
      }));

  describe('with a valid token, environment id and apiEnpoint', () =>
    fancy
      .stdout({ print: true })
      .env({ FOREST_URL: 'http://localhost:3001' })
      .nock('http://localhost:3001', (api) => api
        .put('/api/environments/182', '{"data":{"type":"environments","attributes":{"api-endpoint":"https://super.url.com"}}}')
        .reply(200))
      .command(['environments:update', '-e', '182', '-u', 'https://super.url.com'])
      .it('should stdout "Environment updated"', (ctx) => {
        expect(ctx.stdout).to.contain('Environment updated');
      }));

  describe('without name and apiEndpoint', () =>
    fancy
      .stderr({ print: true })
      .command(['environments:update', '-e', '182'])
      .it('should stderr "Please provide environment name and/or url"', (ctx) => {
        expect(ctx.stderr).to.contain('Please provide environment name and/or url');
      }));
});
