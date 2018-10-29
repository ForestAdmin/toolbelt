const Nock = require('@fancy-test/nock').default;
const Test = require('@oclif/test');
const test = Test.test.register('nock', Nock)
const expect = Test.expect
const ProjectSerializer = require('../../../src/serializers/project');

describe('projects:get', () => {
  test
  .stdout()
  .env({ SERVER_HOST: 'http://localhost:3001' })
  .nock('http://localhost:3001', api => api
    .get('/api/projects/82')
    .reply(200, ProjectSerializer.serialize({
      id: '82',
      name: 'Forest',
      defaultEnvironment: {
        name: 'Production',
        apiEndpoint: 'https://api.forestadmin.com',
        type: 'production',
        id: '2200'
      }})
    )
  )
  .command(['projects:get', '82'])
  .it('should return the configuration of the Forest project', ctx => {
    expect(ctx.stdout).to.contain('PROJECT');
    expect(ctx.stdout).to.contain('id');
    expect(ctx.stdout).to.contain('82');
    expect(ctx.stdout).to.contain('name');
    expect(ctx.stdout).to.contain('Forest');
    expect(ctx.stdout).to.contain('default environment');
    expect(ctx.stdout).to.contain('production');
  })
});
