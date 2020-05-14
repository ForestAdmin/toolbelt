const agent = require('superagent');
const authenticator = require('./authenticator');
const branchDeserializer = require('../deserializers/branch');
const EnvironmentSerializer = require('../serializers/environment');
const { serverHost } = require('../config');
const { handleError } = require('../utils/error');

const ERROR_MESSAGE_PROJECT_IN_V1 = '⚠️  This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_ENV_SECRET_ISSUE = '⚠️  Your development environment is not properly set up. Please run `forest init` first and retry.';
const ERROR_MESSAGE_BRANCH_ALREADY_EXISTS = '❌ This branch already exists.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = '❌ You cannot run branch commands until this project has either a remote or a production environment.';
const ERROR_MESSAGE_BRANCH_DOES_NOT_EXIST = "❌ This branch doesn't exist.";
const ERROR_MESSAGE_REMOVE_BRANCH_FAILED = '❌ Failed to delete branch.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "❌ You need the 'Admin' role on this project to use branches.";

function getBranches(envSecret) {
  const authToken = authenticator.getAuthToken();
  return agent
    .get(`${serverHost()}/api/branches`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', envSecret)
    .send()
    .then((response) => branchDeserializer.deserialize(response.body));
}

function deleteBranch(branchName, environmentSecret) {
  const authToken = authenticator.getAuthToken();

  return agent
    .del(`${serverHost()}/api/branches/${encodeURIComponent(branchName)}`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send();
}

function createBranch(branchName, environmentSecret) {
  const authToken = authenticator.getAuthToken();

  return agent
    .post(`${serverHost()}/api/branches`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send({ branchName: encodeURIComponent(branchName) });
}

function switchBranch(currentBranchName, environmentSecret) {
  const authToken = authenticator.getAuthToken();

  return agent
    .put(`${serverHost()}/api/environments`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send(EnvironmentSerializer.serialize({ currentBranchName }));
}

function handleBranchError(rawError) {
  const error = handleError(rawError);
  switch (error) {
    // NOTICE: When no env/project can be found through envSecret
    case 'Not Found':
      return ERROR_MESSAGE_ENV_SECRET_ISSUE;
    case 'Forbidden':
      return ERROR_MESSAGE_NOT_ADMIN_USER;
    case 'Not development environment.':
      return ERROR_MESSAGE_ENV_SECRET_ISSUE;
    case 'Dev Workflow disabled.':
      return ERROR_MESSAGE_PROJECT_IN_V1;
    case 'Branch name already exists.':
      return ERROR_MESSAGE_BRANCH_ALREADY_EXISTS;
    case 'No production/remote environment.':
      return ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT;
    case 'Branch does not exist.':
      return ERROR_MESSAGE_BRANCH_DOES_NOT_EXIST;
    case 'Failed to remove branch.':
      return ERROR_MESSAGE_REMOVE_BRANCH_FAILED;
    default:
      return error;
  }
}

module.exports = {
  getBranches,
  deleteBranch,
  createBranch,
  switchBranch,
  handleBranchError,
};
