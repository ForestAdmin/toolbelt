const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');

const fancy = test.register('nock', Nock);
const EnvironmentSerializer = require('../../../src/serializers/environment');
const authenticator = require('../../../src/services/authenticator');

describe('environments:get', () => {
  let getAuthToken;
  before(() => {
    getAuthToken = authenticator.getAuthToken;
    authenticator.getAuthToken = () => 'token';
  });
  after(() => { authenticator.getAuthToken = getAuthToken; });

  const mocks = fancy
    .stdout()
    .env({ FOREST_URL: 'http://localhost:3001' })
    .nock('http://localhost:3001', (api) => api
      .matchHeader('forest-environment-id', '324')
      .get('/api/environments/324')
      .reply(200, EnvironmentSerializer.serialize({
        id: '324',
        name: 'Staging',
        apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
        isActive: true,
        type: 'development',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '1.3.2',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
      })));

  mocks
    .command(['environments:get', '324'])
    .it('should return the configuration of the Staging environment', (ctx) => {
      expect(ctx.stdout).to.contain('ENVIRONMENT');
      expect(ctx.stdout).to.contain('id');
      expect(ctx.stdout).to.contain('324');
      expect(ctx.stdout).to.contain('name');
      expect(ctx.stdout).to.contain('Staging');
      expect(ctx.stdout).to.contain('url');
      expect(ctx.stdout).to.contain('https://forestadmin-server-staging.herokuapp.com');
      expect(ctx.stdout).to.contain('type');
      expect(ctx.stdout).to.contain('development');
      expect(ctx.stdout).to.contain('active');
      expect(ctx.stdout).to.contain('true');
      expect(ctx.stdout).to.contain('liana');
      expect(ctx.stdout).to.contain('forest-express-sequelize');
      expect(ctx.stdout).to.contain('version');
      expect(ctx.stdout).to.contain('1.3.2');
      expect(ctx.stdout).to.contain('FOREST_ENV_SECRET');
      expect(ctx.stdout).to.contain('2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125');
    });

  mocks
    .command(['environments:get', '324', '--format', 'json'])
    .it('should return the configuration of the Staging environment', (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.eql({
        name: 'Staging',
        apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
        isActive: true,
        type: 'development',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '1.3.2',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
        id: '324',
      });
    });

  test
    .stderr()
    .env({ FOREST_URL: 'http://localhost:3001' })
    .nock('http://localhost:3001', (api) => api
      .matchHeader('forest-environment-id', '3947')
      .get('/api/environments/3947')
      .reply(404))
    .command(['environments:get', '3947'])
    .it('should display a NotFound error', (ctx) => {
      expect(ctx.stderr).to.contain('Cannot find the environment 3947.\n');
    });
});
