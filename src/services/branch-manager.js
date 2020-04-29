const agent = require('superagent');
const authenticator = require('./authenticator');
const branchDeserializer = require('../deserializers/branch');
const { serverHost } = require('../config');
const ApiErrorDeserializer = require('../deserializers/api-error');

const ERROR_MESSAGE_PROJECT_IN_V1 = '⚠️  This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_ENV_SECRET_ISSUE = '⚠️  Your development environment is not properly set up. Please run `forest init` first and retry.';
const ERROR_MESSAGE_BRANCH_ALREADY_EXISTS = '❌ This branch already exists.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = '❌ You cannot run branch commands until this project has either a remote or a production environment.';

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
    .del(`${serverHost()}/api/branches/${branchName}`)
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
    .send({ branchName });
}

function handleError(error) {
  try {
    const apiError = ApiErrorDeserializer.deserialize(error);

    if (apiError.status === 404) {
      // NOTICE: When no env/project can be found through envSecret
      return ERROR_MESSAGE_ENV_SECRET_ISSUE;
    }

    if (!apiError.message) {
      return 'Unknown server error';
    }

    switch (apiError.message) {
      case 'Workflow disabled.':
        return ERROR_MESSAGE_PROJECT_IN_V1;
      case 'Not development environment.':
        return ERROR_MESSAGE_ENV_SECRET_ISSUE;
      case 'Branch name already exists.':
        return ERROR_MESSAGE_BRANCH_ALREADY_EXISTS;
      case 'No production/remote environment.':
        return ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT;
      default:
        return apiError.message;
    }
  } catch (_) {
    // NOTICE: Client issue or not well formatted server answer
    return 'Oops something went wrong';
  }
}


module.exports = {
  getBranches,
  deleteBranch,
  createBranch,
  handleError,
};
