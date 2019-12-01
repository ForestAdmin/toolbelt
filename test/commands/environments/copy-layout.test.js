const Nock = require('@fancy-test/nock').default;
const { test } = require('@oclif/test');
const _ = require('lodash');
const chai = require('chai');
const chaiSubset = require('chai-subset');

const { expect } = chai;
chai.use(chaiSubset);

const fancy = test.register('nock', Nock);
const EnvironmentSerializer = require('../../../src/serializers/environment');
const JobSerializer = require('../../../src/serializers/job');
const authenticator = require('../../../src/services/authenticator');

describe('environments:copy-layout', () => {
  let getAuthToken;
  before(() => {
    getAuthToken = authenticator.getAuthToken;
    authenticator.getAuthToken = () => 'token';
  });
  after(() => { authenticator.getAuthToken = getAuthToken; });

  describe('on an existing destination environment', () => {
    describe('on a completed job', () => {
      let parsedBody;

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
            isActive: true,
            type: 'development',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
          })))
        .nock('http://localhost:3001', (api) => api
          .get('/api/environments/325')
          .reply(200, EnvironmentSerializer.serialize({
            id: '325',
            name: 'Production',
            apiEndpoint: 'https://forestadmin-server.herokuapp.com',
            isActive: true,
            type: 'production',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
          })))
        .nock('http://localhost:3001', (api) => api
          .post('/api/deployment-requests', (requestBody) => {
            parsedBody = requestBody;
            return requestBody;
          })
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
        .command(['environments:copy-layout', '325', '324', '-p', '82', '--force'])
        .it('should copy the layout', (ctx) => {
          expect(ctx.stdout).to.contain('Environment\'s layout Production successfully copied to Staging.');
        });

      it('should send the correct body', () => {
        expect(parsedBody).to.containSubset({
          data: {
            id: _.isString,
            attributes: {
              type: 'environment',
              from: '325',
              to: '324',
            },
            type: 'deployment-requests',
          },
        });
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
            isActive: true,
            type: 'development',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
          })))
        .nock('http://localhost:3001', (api) => api
          .get('/api/environments/325')
          .reply(200, EnvironmentSerializer.serialize({
            id: '325',
            name: 'Production',
            apiEndpoint: 'https://forestadmin-server.herokuapp.com',
            isActive: true,
            type: 'production',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
          })))
        .nock('http://localhost:3001', (api) => api
          .post('/api/deployment-requests')
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
        .command(['environments:copy-layout', '325', '324', '-p', '82', '--force'])
        .exit(1)
        .it('should exit with status 1');
    });
  });

  describe('on an unexisting destination environment', () => {
    fancy
      .stdout()
      .stderr()
      .env({ FOREST_URL: 'http://localhost:3001' })
      .nock('http://localhost:3001', (api) => api
        .get('/api/environments/324')
        .reply(404))
      .nock('http://localhost:3001', (api) => api
        .get('/api/environments/325')
        .reply(200, EnvironmentSerializer.serialize({
          id: '325',
          name: 'Production',
          apiEndpoint: 'https://forestadmin-server.herokuapp.com',
          isActive: true,
          type: 'production',
          lianaName: 'forest-express-sequelize',
          lianaVersion: '1.3.2',
          secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
        })))
      .command(['environments:copy-layout', '325', '324', '-p', '82', '--force'])
      .exit(3)
      .it('should exit with status 3');
  });
});
