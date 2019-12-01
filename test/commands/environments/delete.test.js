const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');

const fancy = test.register('nock', Nock);
const EnvironmentSerializer = require('../../../src/serializers/environment');
const JobSerializer = require('../../../src/serializers/job');
const authenticator = require('../../../src/services/authenticator');

describe('environments:delete', () => {
  let getAuthToken;
  before(() => {
    getAuthToken = authenticator.getAuthToken;
    authenticator.getAuthToken = () => 'token';
  });
  after(() => { authenticator.getAuthToken = getAuthToken; });

  describe('on an existing environment', () => {
    describe('on a completed job', () => {
      fancy
        .stdout()
        .stderr()
        .env({ FOREST_URL: 'http://localhost:3001' })
        .nock('http://localhost:3001', (api) => api
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
          })))
        .nock('http://localhost:3001', (api) => api
          .delete('/api/environments/324')
          .reply(200, {
            meta: {
              job_id: 78,
            },
          }))
        .nock('http://localhost:3001', (api) => api
          .get('/api/jobs/78')
          .reply(200, JobSerializer.serialize({
            state: 'complete',
            progress: '100',
          })))
        .command(['environments:delete', '324', '-p', '82', '--force'])
        .it('should delete the environment', (ctx) => {
          expect(ctx.stdout).to.contain('Environment Staging successfully deleted.');
        });
    });

    describe('on a failed job', () => {
      fancy
        .stdout()
        .stderr()
        .env({ FOREST_URL: 'http://localhost:3001' })
        .nock('http://localhost:3001', (api) => api
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
          })))
        .nock('http://localhost:3001', (api) => api
          .delete('/api/environments/324')
          .reply(200, {
            meta: {
              job_id: 78,
            },
          }))
        .nock('http://localhost:3001', (api) => api
          .get('/api/jobs/78')
          .reply(200, JobSerializer.serialize({
            state: 'failed',
            progress: '10',
          })))
        .command(['environments:delete', '324', '-p', '82', '--force'])
        .exit(1)
        .it('should exit with status 1');
    });
  });

  describe('on an unexisting environment', () => {
    fancy
      .stderr()
      .env({ FOREST_URL: 'http://localhost:3001' })
      .nock('http://localhost:3001', (api) => api
        .get('/api/environments/324')
        .reply(404))
      .command(['environments:delete', '324', '-p', '82', '--force'])
      .exit(1)
      .it('should exit with status 1');
  });
});
