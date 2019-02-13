/* global describe */
const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');

const fancy = test.register('nock', Nock);
const EnvironmentSerializer = require('../../../src/serializers/environment');
const authenticator = require('../../../src/services/authenticator');

describe('environments', () => {
  let getAuthToken;
  before(() => {
    getAuthToken = authenticator.getAuthToken;
    authenticator.getAuthToken = () => 'token';
  });
  after(() => { authenticator.getAuthToken = getAuthToken; });

  const mocks = fancy
    .stdout()
    .env({ SERVER_HOST: 'http://localhost:3001' })
    .nock('http://localhost:3001', api => api
      .get('/api/projects/82/environments')
      .reply(200, EnvironmentSerializer.serialize([{
        id: '324',
        name: 'Staging',
        apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
        isActive: true,
        type: 'development',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '1.3.2',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
      }, {
        id: '325',
        name: 'Production',
        apiEndpoint: 'https://forestadmin-server.herokuapp.com',
        isActive: true,
        type: 'production',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '1.3.2',
        secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
      }])));

  mocks
    .command(['environments', '-p', '82'])
    .it('should return the list of environments', (ctx) => {
      expect(ctx.stdout).to.contain('ENVIRONMENTS');

      expect(ctx.stdout).to.contain('ID');
      expect(ctx.stdout).to.contain('324');
      expect(ctx.stdout).to.contain('NAME');
      expect(ctx.stdout).to.contain('Staging');
      expect(ctx.stdout).to.contain('URL');
      expect(ctx.stdout).to.contain('https://');
      expect(ctx.stdout).to.contain('TYPE');
      expect(ctx.stdout).to.contain('development');

      expect(ctx.stdout).to.contain('ID');
      expect(ctx.stdout).to.contain('325');
      expect(ctx.stdout).to.contain('NAME');
      expect(ctx.stdout).to.contain('Production');
      expect(ctx.stdout).to.contain('URL');
      expect(ctx.stdout).to.contain('https://');
      expect(ctx.stdout).to.contain('TYPE');
      expect(ctx.stdout).to.contain('production');
    });

  mocks
    .command(['environments', '-p', '82', '--format', 'json'])
    .it('should return the list of environments in JSON', (ctx) => {
      expect(JSON.parse(ctx.stdout)).to.eql([
        {
          id: '324',
          name: 'Staging',
          apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
          isActive: true,
          type: 'development',
          lianaName: 'forest-express-sequelize',
          lianaVersion: '1.3.2',
          secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
        },
        {
          id: '325',
          name: 'Production',
          apiEndpoint: 'https://forestadmin-server.herokuapp.com',
          isActive: true,
          type: 'production',
          lianaName: 'forest-express-sequelize',
          lianaVersion: '1.3.2',
          secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
        },
      ]);
    });
});
