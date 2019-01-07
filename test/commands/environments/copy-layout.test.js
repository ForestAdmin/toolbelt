/* global describe */
const Nock = require('@fancy-test/nock').default;
const { test } = require('@oclif/test');
const _ = require('lodash');
const chai = require('chai');
const chaiSubset = require('chai-subset');

const { expect } = chai;
chai.use(chaiSubset);

const fancy = test.register('nock', Nock);
const EnvironmentSerializer = require('../../../src/serializers/environment');

describe('environments:copy-layout', () => {
  let parsedBody;

  const mocks = fancy
    .stdout()
    .env({ SERVER_HOST: 'http://localhost:3001' })
    .nock('http://localhost:3001', api => api
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
    .nock('http://localhost:3001', api => api
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
    .nock('http://localhost:3001', api => api
      .post('/api/deployment-requests', (body) => {
        parsedBody = body;
        return body;
      })
      .reply(204));

  mocks
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
