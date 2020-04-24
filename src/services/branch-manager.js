const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const { serverHost } = require('../config');

const ERROR_MESSAGE_PROJECT_IN_V1 = '⚠️  This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_ENV_SECRET_ISSUE = '⚠️  Your development environment is not properly set up. Please run `forest init` first and retry.';
const ERROR_MESSAGE_BRANCH_ALREADY_EXISTS = '❌ This branch already exists.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = '❌ You cannot create a branch until this project has either a remote or a production environment.';

async function getBranches() {
  // FIXME: Implement getBranches function
}

async function deleteBranch() {
  // FIXME: Implement deleteBranch function
}

async function createBranch(branchName) {
  const authToken = authenticator.getAuthToken();

  await agent
    .post(`${serverHost()}/api/branches`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${process.env.FOREST_ENV_SECRET}`)
    .send({ branchName });
}

function handleError(error) {
  try {
    const { status } = error;

    if (status === 404) {
      // NOTICE: When no env/project can be found through envSecret
      return ERROR_MESSAGE_ENV_SECRET_ISSUE;
    }

    const message = JSON.parse(error.response.text).errors[0].detail;

    if (!message) {
      return 'Unknown server error';
    }

    switch (message) {
      case 'Workflow disabled':
        return ERROR_MESSAGE_PROJECT_IN_V1;
      case 'Not development environment':
        return ERROR_MESSAGE_ENV_SECRET_ISSUE;
      case 'Branch name already exists':
        return ERROR_MESSAGE_BRANCH_ALREADY_EXISTS;
      case 'No production/remote environment':
        return ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT;
      default:
        return message;
    }
  } catch (err) {
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
