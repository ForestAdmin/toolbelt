const Nock = require('@fancy-test/nock').default;
const Test = require('@oclif/test');
const test = Test.test.register('nock', Nock)
const expect = Test.expect
const EnvironmentSerializer= require('../../../src/serializers/environment');

describe('environments:create', () => {
  const mocks = test
    .stdout()
    .env({ SERVER_HOST: 'http://localhost:3001' })
    .nock('http://localhost:3001', api => api
      .post('/api/environments')
      .reply(200, EnvironmentSerializer.serialize({
        name: 'Test',
        apiEndpoint: 'https://test.forestadmin.com',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
      }))
  );

  mocks
    .command(['environments:create', '-p', '82', '-n', 'Test', '-u', 'https://test.forestadmin.com'])
    .it('should returns the freshly created environment', ctx => {
      expect(ctx.stdout).to.contain('ENVIRONMENT');
      expect(ctx.stdout).to.contain('id');
      expect(ctx.stdout).to.contain('name');
      expect(ctx.stdout).to.contain('Test');
      expect(ctx.stdout).to.contain('url');
      expect(ctx.stdout).to.contain('https://test.forestadmin.com');
      expect(ctx.stdout).to.contain('type');
      expect(ctx.stdout).to.contain('active');
      expect(ctx.stdout).to.contain('liana');
      expect(ctx.stdout).to.contain('version');
      expect(ctx.stdout).to.contain('FOREST_ENV_SECRET');
      expect(ctx.stdout).to.contain('2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125');
    });

  mocks
    .command(['environments:create', '-p', '82', '-n', 'Test', '-u', 'https://test.forestadmin.com',
      '--format', 'json'])
    .it('should returns the freshly created environment in JSON', ctx => {
      expect(JSON.parse(ctx.stdout)).to.eql({
        name: 'Test',
        apiEndpoint: 'https://test.forestadmin.com',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
      });
    });
})
