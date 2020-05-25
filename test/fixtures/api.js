const nock = require('nock');
const jwt = require('jsonwebtoken');
const ProjectSerializer = require('../../src/serializers/project');
const EnvironmentSerializer = require('../../src/serializers/environment');
const JobSerializer = require('../../src/serializers/job');

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

  getProjectListSingleProject: () => nock('http://localhost:3001')
    .get('/api/projects')
    .reply(200, ProjectSerializer.serialize([{ id: 1, name: 'project1' }])),

  getProjectListEmpty: () => nock('http://localhost:3001')
    .get('/api/projects')
    .reply(200, ProjectSerializer.serialize([])),

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

  getProjectByEnv: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .get('/api/projects?envSecret')
    .matchHeader('forest-secret-key', envSecret)
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

  getBranchListValid: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(200, {
      data: {
        attributes: [
          { name: 'feature/first' },
          { name: 'feature/second', isCurrent: true },
          { name: 'feature/third' },
        ],
      },
    }),

  getNoBranchListValid: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(200, {
      data: [],
    }),

  getBranchInvalidEnvSecret: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(404),

  getBranchInvalidEnvironmentV1: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(422, JSON.stringify({
      errors: [{
        detail: 'Dev Workflow disabled.',
      }],
    })),

  getBranchInvalidNotDevEnv: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(422, JSON.stringify({
      errors: [{
        detail: 'Not development environment.',
      }],
    })),

  getBranchInvalidEnvironmentNoRemote: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .get('/api/branches')
    .reply(422, JSON.stringify({
      errors: [{
        detail: 'No production/remote environment.',
      }],
    })),

  postBranchValid: (branchName) => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .post('/api/branches')
    .reply(200, {
      data: {
        type: 'branches',
        attributes: { name: branchName },
      },
    }),

  postBranchValidOnSpecificEnv: (branchName, envSecret) => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/branches')
    .reply(200, {
      data: {
        type: 'branches',
        attributes: { name: branchName },
      },
    }),

  postBranchInvalid: () => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .post('/api/branches')
    .reply(409, JSON.stringify({
      errors: [{
        detail: 'Branch name already exists.',
      }],
    })),

  deleteBranchValid: (branchName = 'random-branch') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .delete(`/api/branches/${branchName}`)
    .reply(200, {
      data: {
        type: 'branches',
        attributes: {
          name: branchName,
        },
      },
    }),

  deleteUnknownBranch: (branchName = 'random-branch') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .delete(`/api/branches/${branchName}`)
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'Branch does not exist.',
      }],
    })),

  deleteBranchInvalid: (branchName = 'random-branch') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .delete(`/api/branches/${branchName}`)
    .reply(400, JSON.stringify({
      errors: [{
        detail: 'Failed to remove branch.',
      }],
    })),

  getDevelopmentEnvironmentNotFound: () => nock('http://localhost:3001')
    .get('/api/projects/1/development-environment-for-user')
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'Development environment not found.',
      }],
    })),

  getDevelopmentEnvironmentValid: (projectId = 1) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/development-environment-for-user`)
    .reply(200, EnvironmentSerializer.serialize({
      name: 'Test',
      type: 'development',
      apiEndpoint: 'https://test.forestadmin.com',
      secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
    })),

  updateEnvironmentCurrentBranchId: () => nock('http://localhost:3001')
    .put('/api/environments')
    .matchHeader('forest-secret-key', 'forestEnvSecret')
    .reply(200, EnvironmentSerializer.serialize({
      name: 'Test',
      type: 'development',
      apiEndpoint: 'https://test.forestadmin.com',
      secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
    })),

  getV1ProjectForDevWorkflow: (projectId) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(422, JSON.stringify({
      errors: [{
        detail: 'Dev Workflow disabled.',
      }],
    })),

  getNoProdProjectForDevWorkflow: (projectId) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(422, JSON.stringify({
      errors: [{
        detail: 'No production/remote environment.',
      }],
    })),

  getInAppProjectForDevWorkflow: (projectId) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(200, ProjectSerializer.serialize({ id: `${projectId}`, name: 'Forest', origin: 'In-app' })),

  getLumberProjectForDevWorkflow: (projectId) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(200, ProjectSerializer.serialize({ id: `${projectId}`, name: 'Forest', origin: 'Lumber' })),

  getProjectNotFoundForDevWorkflow: (projectId = '1') => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'Project not found',
      }],
    })),

  getProjectForDevWorkflowUnallowed: (projectId = '1') => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/dev-workflow`)
    .reply(403, JSON.stringify({
      errors: [{
        detail: 'Forbidden',
      }],
    })),
};
