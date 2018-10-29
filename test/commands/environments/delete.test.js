const Nock = require('@fancy-test/nock').default;
const Test = require('@oclif/test');
const test = Test.test.register('nock', Nock)
const expect = Test.expect
const EnvironmentSerializer= require('../../../src/serializers/environment');

describe('environments:delete', () => {
  test
  .stdout()
  .env({ SERVER_HOST: 'http://localhost:3001' })
  .nock('http://localhost:3001', api => api
    .get('/api/environments/324')
    .reply(200, EnvironmentSerializer.serialize({
      id: '324',
      name: 'Staging',
      apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
      active: true,
      type: 'development',
      liana: 'forest-express-sequelize',
      version: '1.3.2',
      FOREST_ENV_SECRET: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
    })
  ))
  .nock('http://localhost:3001', api => api
    .delete('/api/environments/324')
    .reply(204)
  )
  .command(['environments:delete', '324', '-p', '82', '--force'])
  .it('should delete the environment', ctx => {
    expect(ctx.stdout).to.contain('Environment Staging successfully deleted.');
  })

  test
  .stderr()
  .env({ SERVER_HOST: 'http://localhost:3001' })
  .nock('http://localhost:3001', api => api
    .get('/api/environments/324')
    .reply(404)
  )
  .command(['environments:delete', '324', '-p', '82', '--force'])
  .it('should display a NotFound error', ctx => {
    expect(ctx.stderr).to.contain('Cannot find the environment 324 on the project 82.');
  })
});
