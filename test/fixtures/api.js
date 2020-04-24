const nock = require('nock');
const jwt = require('jsonwebtoken');
const ProjectSerializer = require('../../src/serializers/project');
const EnvironmentSerializer = require('../../src/serializers/environment');
const JobSerializer = require('../../src/serializers/job');
const BranchSerializer = require('../../src/serializers/branch');

module.exports = {
  aGoogleAccount: () => nock('http://localhost:3001')
    .get('/api/users/google/robert@gmail.com')
    .reply(200, { data: { isGoogleAccount: true } }),

  notAGoogleAccount: () => nock('http://localhost:3001')
    .get('/api/users/google/some@mail.com')
    .reply(200, { data: { isGoogleAccount: false } }),

  loginValid: () => nock('http://localhost:3001')
    .post('/api/sessions', { email: 'some@mail.com', password: 'valid_pwd' })
    .reply(200, { token: jwt.sign({}, 'key', { expiresIn: '1day' }) }),

  loginInvalid: () => nock('http://localhost:3001')
    .post('/api/sessions', { email: 'some@mail.com', password: 'pwd' })
    .reply(401),

  getProjectValid: () => nock('http://localhost:3001')
    .get('/api/projects/82')
    .reply(200, ProjectSerializer.serialize({
      id: '82',
      name: 'Forest',
      defaultEnvironment: {
        name: 'Production',
        apiEndpoint: 'https://api.forestadmin.com',
        type: 'production',
        id: '2200',
      },
    })),

  getProjectListValid: () => nock('http://localhost:3001')
    .get('/api/projects')
    .reply(200, ProjectSerializer.serialize([
      { id: 1, name: 'project1' },
      { id: 2, name: 'project2' },
    ])),

  getProjectDetailledList: () => nock('http://localhost:3001')
    .get('/api/projects')
    .reply(200, ProjectSerializer.serialize([{
      id: '82',
      name: 'Forest',
      defaultEnvironment: {
        id: '2200',
        name: 'Production',
        apiEndpoint: 'https://api.forestadmin.com',
        type: 'production',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '2.13.1',
        renderings: [{ isDefault: true, id: '4911' }],
      },
    }, {
      id: '21',
      name: 'Illustrio',
      defaultEnvironment: {
        id: '39',
        name: 'Production',
        apiEndpoint: 'http://dev.illustrio.com:5001',
        type: 'development',
        lianaName: 'forest-express-mongoose',
        lianaVersion: '0.2.17',
        renderings: [{ isDefault: true, id: '68' }],
      },
    }])),

  getEnvironmentListValid: () => nock('http://localhost:3001')
    .get('/api/projects/2/environments')
    .reply(200, EnvironmentSerializer.serialize([
      {
        id: 3, name: 'name1', apiEndpoint: 'http://localhost:1', type: 'type1',
      },
      {
        id: 4, name: 'name2', apiEndpoint: 'http://localhost:2', type: 'type2',
      },
    ])),

  getEnvironmentListValid2: () => nock('http://localhost:3001')
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
    }])),

  getEnvironmentValid: () => nock('http://localhost:3001')
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
    })),

  getEnvironmentValid2: () => nock('http://localhost:3001')
    .matchHeader('forest-environment-id', '325')
    .get('/api/environments/325')
    .reply(200, EnvironmentSerializer.serialize({
      id: '325',
      name: 'Production',
      apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
      isActive: true,
      type: 'development',
      lianaName: 'forest-express-sequelize',
      lianaVersion: '1.3.2',
      secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
    })),

  createEnvironmentValid: () => nock('http://localhost:3001')
    .post('/api/environments', {
      data: {
        type: 'environments',
        attributes: { name: 'Test', 'api-endpoint': 'https://test.forestadmin.com' },
        relationships: { project: { data: { type: 'projects', id: '2' } } },
      },
    })
    .reply(200, EnvironmentSerializer.serialize({
      name: 'Test',
      apiEndpoint: 'https://test.forestadmin.com',
      secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
    })),

  getEnvironmentNotFound: (id = '3947') => nock('http://localhost:3001')
    .matchHeader('forest-environment-id', id)
    .get(`/api/environments/${id}`)
    .reply(404),

  updateEnvironmentName: () => nock('http://localhost:3001')
    .put('/api/environments/182', {
      data: {
        type: 'environments',
        attributes: { name: 'NewName' },
      },
    })
    .reply(200),

  updateEnvironmentEndpoint: () => nock('http://localhost:3001')
    .put('/api/environments/182', {
      data: {
        type: 'environments',
        attributes: { 'api-endpoint': 'https://super.url.com' },
      },
    })
    .reply(200),

  deleteEnvironment: () => nock('http://localhost:3001')
    .matchHeader('forest-environment-id', '324')
    .delete('/api/environments/324')
    .reply(200, {
      meta: {
        job_id: 78,
      },
    }),

  getJob: () => nock('http://localhost:3001')
    .get('/api/jobs/78')
    .reply(200, JobSerializer.serialize({
      state: 'complete',
      progress: '100',
    })),

  getJobFailed: () => nock('http://localhost:3001')
    .get('/api/jobs/78')
    .reply(200, JobSerializer.serialize({
      state: 'failed',
      progress: '10',
    })),

  postCopyLayout: () => nock('http://localhost:3001')
    .post('/api/deployment-requests', {
      data: {
        id: /.+/,
        attributes: {
          type: 'environment',
          from: '325',
          to: '324',
        },
        type: 'deployment-requests',
      },
    })
    .reply(200, {
      meta: {
        job_id: 78,
      },
    }),

  postSchema: (match) => nock('http://localhost:3001')
    .post('/forest/apimaps', match).reply(200),

  postSchema404: () => nock('http://localhost:3001')
    .post('/forest/apimaps')
    .reply(404),

  postSchema503: () => nock('http://localhost:3001')
    .post('/forest/apimaps')
    .reply(503),

  postSchema500: () => nock('http://localhost:3001')
    .post('/forest/apimaps')
    .reply(500),

  // NOTICE: I've added this new mock to conform your current use-case (via 'withCurrentProject')
  // Please verify this is what you want (with env:testEnv2 in your test you have envSecret and
  // this call)
  getProjectByEnv:() => nock('http://localhost:3001')
    .get('/api/projects?envSecret')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .reply(200, ProjectSerializer.serialize({
      id: '82',
      name: 'Forest',
      defaultEnvironment: {
        name: 'Production',
        apiEndpoint: 'https://api.forestadmin.com',
        type: 'production',
        id: '2200',
      },
    })),

  // I think you should add here a check for the headers.
  getBranchListValid: () => nock('http://localhost:3001')
    .get('/api/branches')
    .reply(200, BranchSerializer.serialize([
      { name: 'feature/first' },
      //TODO I add ' < current branch' here just for the test to pass but it's up to you.
      { name: 'feature/second < current branch', isCurrent: true },
      { name: 'feature/third' },
    ])),
};
