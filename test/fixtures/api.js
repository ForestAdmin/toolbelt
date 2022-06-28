const nock = require('nock');
const jwt = require('jsonwebtoken');
const ProjectSerializer = require('../../src/serializers/project');
const EnvironmentSerializer = require('../../src/serializers/environment');
const JobSerializer = require('../../src/serializers/job');

/**
 * @param {import('nock').Scope} nockScope
 */
function getOidcConfig(nockScope) {
  return nockScope
    .get('/oidc/.well-known/openid-configuration')
    .reply(200, {
      authorization_endpoint: 'http://localhost:3001/oidc/auth',
      device_authorization_endpoint: 'http://localhost:3001/oidc/device/auth',
      claims_parameter_supported: false,
      claims_supported: ['sub', 'email', 'sid', 'auth_time', 'iss'],
      code_challenge_methods_supported: ['S256'],
      end_session_endpoint: 'http://localhost:3001/oidc/session/end',
      grant_types_supported: ['implicit', 'authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
      id_token_signing_alg_values_supported: ['HS256', 'RS256'],
      issuer: 'http://localhost:3001',
      jwks_uri: 'http://localhost:3001/oidc/jwks',
      registration_endpoint: 'http://localhost:3001/oidc/reg',
      response_modes_supported: ['form_post', 'fragment', 'query'],
      response_types_supported: ['code id_token', 'code', 'id_token', 'none'],
      scopes_supported: ['openid', 'offline_access', 'email'],
      subject_types_supported: ['public'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_jwt', 'client_secret_post', 'private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
      token_endpoint: 'http://localhost:3001/oidc/token',
      request_object_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
      request_parameter_supported: false,
      request_uri_parameter_supported: true,
      require_request_uri_registration: true,
      userinfo_endpoint: 'http://localhost:3001/oidc/me',
      userinfo_signing_alg_values_supported: ['HS256', 'RS256'],
      introspection_endpoint: 'http://localhost:3001/oidc/token/introspection',
      introspection_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_jwt', 'client_secret_post', 'private_key_jwt'],
      introspection_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
      revocation_endpoint: 'http://localhost:3001/oidc/token/revocation',
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_jwt', 'client_secret_post', 'private_key_jwt'],
      revocation_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
      claim_types_supported: ['normal'],
    });
}

/**
 * @param {import('nock').Scope} scope
 */
function registerOidcClient(scope) {
  return scope
    .post('/oidc/reg', {
      name: 'forest-cli',
      application_type: 'native',
      redirect_uris: ['com.forestadmin.cli://authenticate'],
      token_endpoint_auth_method: 'none',
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
      response_types: ['none'],
    })
    .reply(201, {
      client_id: 'the-client-id',
      name: 'forest-cli',
      application_type: 'native',
      redirect_uris: ['com.forestadmin.cli://authenticate'],
      token_endpoint_auth_method: 'none',
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
      response_types: ['none'],
    });
}

/**
 * @param {import('nock').Scope} scope
 */
function startAuthenticationFlow(scope) {
  return scope.post('/oidc/device/auth', 'client_id=the-client-id&scope=openid&scopes=openid%2Cemail%2Cprofile')
    .reply(200, {
      user_code: 'USER-CODE',
      verification_uri: 'http://app.localhost/device/check',
      verification_uri_complete: 'http://app.localhost/device/check?code=ABCD',
      device_code: 'DEVICE-CODE',
      expires_in: 3600,
      interval: 1,
    });
}

/**
 * @param {import('nock').Scope} scope
 */
function authenticationFailed(scope) {
  return scope.post('/oidc/token', 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=DEVICE-CODE&client_id=the-client-id')
    .reply(401, {
      error: 'The authentication failed',
    });
}

/**
 * @param {import('nock').Scope} scope
 */
function authenticationSucceeded(scope) {
  return scope.post('/oidc/token', 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=DEVICE-CODE&client_id=the-client-id')
    .reply(200, {
      access_token: jwt.sign({}, 'key', { expiresIn: '1day' }),
    });
}

/**
 * @param {import('nock').Scope} scope
 */
function createAuthenticationToken(scope) {
  return scope.post('/api/application-tokens', {
    data: {
      type: 'application-tokens',
      attributes: {
        name: /forest-cli @.+/,
      },
    },
  })
    .matchHeader('authorization', /Bearer .+/)
    .matchHeader('forest-origin', 'forest-cli')
    .reply(200, {
      data: {
        id: 42,
        attributes: {
          token: jwt.sign({}, 'key', { expiresIn: '1day' }),
        },
      },
    });
}

function loginInvalidOidc() {
  const scope = nock('http://localhost:3001');

  return [
    getOidcConfig,
    registerOidcClient,
    startAuthenticationFlow,
    authenticationFailed,
  ].reduce(
    (currentScope, registration) => registration(currentScope),
    scope,
  );
}

function loginValidOidc() {
  const scope = nock('http://localhost:3001');

  return [
    getOidcConfig,
    registerOidcClient,
    startAuthenticationFlow,
    authenticationSucceeded,
    createAuthenticationToken,
  ].reduce(
    (currentScope, registration) => registration(currentScope),
    scope,
  );
}

module.exports = {
  loginInvalidOidc,
  loginValidOidc,

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

  getProjectofOrganizationDetailledList: () => nock('http://localhost:3001')
    .get('/api/projects?organizationId=2')
    .reply(200, ProjectSerializer.serialize([{
      id: '83',
      name: 'Forest in org',
      defaultEnvironment: {
        id: '2201',
        name: 'Production',
        apiEndpoint: 'https://api.forestadmin.com',
        type: 'production',
        lianaName: 'forest-express-sequelize',
        lianaVersion: '2.13.1',
        renderings: [{ isDefault: true, id: '4912' }],
      },
    }, {
      id: '22',
      name: 'Illustrio in org',
      defaultEnvironment: {
        id: '40',
        name: 'Production',
        apiEndpoint: 'http://dev.illustrio.com:5001',
        type: 'development',
        lianaName: 'forest-express-mongoose',
        lianaVersion: '0.2.17',
        renderings: [{ isDefault: true, id: '69' }],
      },
    }])),

  getEnvironmentListValid: (projectId = 2) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/environments`)
    .reply(200, EnvironmentSerializer.serialize([
      {
        id: 3, name: 'name1', apiEndpoint: 'http://localhost:1', type: 'remote',
      },
      {
        id: 4, name: 'name2', apiEndpoint: 'http://localhost:2', type: 'production',
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

  getNoEnvironmentListValid: (projectId = 2) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/environments`)
    .reply(200, {
      data: [],
    }),

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

  createEnvironmentForbidden: () => nock('http://localhost:3001')
    .post('/api/environments')
    .reply(403),

  createEnvironmentDetailedError: () => nock('http://localhost:3001')
    .post('/api/environments')
    .reply(422, { errors: [{ detail: 'dummy test error' }] }),

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
    .reply(200),

  deleteEnvironmentFailure: () => nock('http://localhost:3001')
    .matchHeader('forest-environment-id', '324')
    .delete('/api/environments/324')
    .reply(404),

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

  getProjectByEnvIncludeLegacy: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .get('/api/projects?envSecret&includeLegacy')
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

  getBranchListValid: (envSecret = 'forestEnvSecret', haveCurrent = true) => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .get('/api/branches')
    .reply(200, {
      data: [
        {
          type: 'branches',
          attributes: { name: 'feature/first' },
          relationships: {
            originEnvironment: {
              data: { id: '325', type: 'environments' },
            },
          },
        },
        {
          type: 'branches',
          attributes: { name: 'feature/second', isCurrent: haveCurrent },
          relationships: {
            originEnvironment: {
              data: { id: '325', type: 'environments' },
            },
          },
        },
        {
          type: 'branches',
          attributes: { name: 'feature/third' },
          relationships: {
            originEnvironment: {
              data: { id: '325', type: 'environments' },
            },
          },
        },
      ],
    }),

  getNoBranchListValid: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
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
        detail: 'Environment is not in development.',
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

  pushBranchValid: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/branches/push')
    .reply(200, {
      data: {
        type: 'branches',
        attributes: {
          name: 'branchPushed',
        },
      },
    }),

  pushBranchInvalidDestination: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/branches/push')
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'Environment not found.',
      }],
    })),

  pushBranchInvalidType: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/branches/push')
    .reply(400, JSON.stringify({
      errors: [{
        detail: 'Environment type should be remote.',
      }],
    })),

  pushBranchInvalidDestinationBranch: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/branches/push')
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'No destination branch.',
      }],
    })),

  deployValid: (envSecret = 'forestEnvSecret') => nock('http://localhost:3001')
    .matchHeader('forest-secret-key', envSecret)
    .post('/api/environments/deploy')
    .reply(200, {}),

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

  getDevelopmentEnvironmentNotFound: (projectId = 1) => nock('http://localhost:3001')
    .get(`/api/projects/${projectId}/development-environment-for-user`)
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

  createDevelopmentEnvironment: (projectId = 1) => nock('http://localhost:3001')
    .post(`/api/projects/${projectId}/development-environment-for-user`, { endpoint: 'http://localhost:3310' })
    .reply(200, EnvironmentSerializer.serialize({
      name: 'Test',
      type: 'development',
      apiEndpoint: 'http://localhost:3310',
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

  getForestCLIProjectForDevWorkflow: (projectId) => nock('http://localhost:3001')
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

  createProject: ({ databaseType }) => nock('http://localhost:3001')
    .post('/api/projects', {
      data: {
        type: 'projects',
        attributes: {
          name: 'name',
          agent: 'express-sequelize',
          architecture: 'microservice',
          database_type: databaseType,
        },
      },
    })
    .reply(201, ProjectSerializer.serialize({
      name: 'name',
      id: 4242,
      defaultEnvironment: {
        id: 182,
        name: 'development',
        apiEndpoint: 'http://localhost:3310',
        type: 'development',
        secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
      },
      origin: 'Lumber',
    })),
  updateNewEnvironmentEndpoint: () => nock('http://localhost:3001')
    .put('/api/environments/182', {
      data: {
        type: 'environments',
        id: '182',
        attributes: {
          name: 'development',
          'api-endpoint': 'http://localhost:3310',
          type: 'development',
        },
      },
    })
    .reply(200, EnvironmentSerializer.serialize({
      name: 'development',
      apiEndpoint: 'http://localhost:3310',
      type: 'development',
      secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
    })),
  resetRemoteEnvironment: () => nock('http://localhost:3001')
    .post('/api/environments/reset', {
      environmentName: 'name1',
    })
    .reply(200),
  resetRemoteUnexistingEnvironment: () => nock('http://localhost:3001')
    .post('/api/environments/reset', {
      environmentName: 'name2',
    })
    .reply(404, JSON.stringify({
      errors: [{
        detail: 'Environment not found.',
      }],
    })),
  resetRemoteDisallowedEnvironment: () => nock('http://localhost:3001')
    .post('/api/environments/reset', {
      environmentName: 'name2',
    })
    .reply(403),
  resetRemoteEnvironmentFailed: () => nock('http://localhost:3001')
    .post('/api/environments/reset', {
      environmentName: 'name2',
    })
    .reply(422),
};
