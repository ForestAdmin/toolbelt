const Context = require('@forestadmin/context');
const branchDeserializer = require('../deserializers/branch');
const EnvironmentSerializer = require('../serializers/environment');
const { handleError } = require('../utils/error');

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_ENV_SECRET_ISSUE = 'Your development environment is not properly set up. Please run `forest init` first and retry.';
const ERROR_MESSAGE_BRANCH_ALREADY_EXISTS = 'This branch already exists.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = 'You cannot run branch commands until this project has either a remote or a production environment.';
const ERROR_MESSAGE_NO_REMOTE_ENVIRONMENT = 'You cannot run this command until this project has a remote non-production environment.';
const ERROR_MESSAGE_BRANCH_DOES_NOT_EXIST = 'This branch doesn\'t exist.';
const ERROR_MESSAGE_REMOVE_BRANCH_FAILED = 'Failed to delete branch.';
const ERROR_MESSAGE_NOT_ADMIN_USER = 'You need the \'Admin\' role on this project to use branches.';
const ERROR_MESSAGE_ENVIRONMENT_NOT_FOUND = 'The environment provided doesn\'t exist.';
const ERROR_MESSAGE_NO_CURRENT_BRANCH = 'You don\'t have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.';
const ERROR_MESSAGE_WRONG_ENVIRONMENT_TYPE = 'The environment on which you are trying to push your modifications is not a remote environment.';
const ERROR_MESSAGE_NO_DESTINATION_BRANCH = 'The environment on which you are trying to push your modifications doesn\'t have current branch.';

function getBranches(envSecret) {
  const {
    assertPresent,
    authenticator,
    env,
    superagent: agent,
  } = Context.inject();
  assertPresent({ authenticator, env, superagent: agent });
  const authToken = authenticator.getAuthToken();
  return agent
    .get(`${env.FOREST_URL}/api/branches`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', envSecret)
    .send()
    .then((response) => branchDeserializer.deserialize(response.body));
}

function deleteBranch(branchName, environmentSecret) {
  const {
    assertPresent,
    authenticator,
    env,
    superagent: agent,
  } = Context.inject();
  assertPresent({ authenticator, env, superagent: agent });
  const authToken = authenticator.getAuthToken();

  return agent
    .del(`${env.FOREST_URL}/api/branches/${encodeURIComponent(branchName)}`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send();
}

function createBranch(branchName, environmentSecret) {
  const {
    assertPresent,
    authenticator,
    env,
    superagent: agent,
  } = Context.inject();
  assertPresent({ authenticator, env, superagent: agent });
  const authToken = authenticator.getAuthToken();

  return agent
    .post(`${env.FOREST_URL}/api/branches`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send({ branchName: encodeURIComponent(branchName) });
}

// TODO: DWO EP17 remove destinationEnvironmentName handle
function pushBranch(destinationEnvironmentName, environmentSecret) {
  const {
    assertPresent,
    authenticator,
    env,
    superagent: agent,
  } = Context.inject();
  assertPresent({ authenticator, env, superagent: agent });
  const authToken = authenticator.getAuthToken();

  return agent
    .post(`${env.FOREST_URL}/api/branches/push`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send({ destinationEnvironmentName: encodeURIComponent(destinationEnvironmentName) });
}

function switchBranch({ id }, environmentSecret) {
  const {
    assertPresent,
    authenticator,
    env,
    superagent: agent,
  } = Context.inject();
  assertPresent({ authenticator, env, superagent: agent });
  const authToken = authenticator.getAuthToken();

  return agent
    .put(`${env.FOREST_URL}/api/environments`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send(EnvironmentSerializer.serialize({ currentBranchId: id }));
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
    case 'No remote environment.':
      return ERROR_MESSAGE_NO_REMOTE_ENVIRONMENT;
    case 'Branch does not exist.':
      return ERROR_MESSAGE_BRANCH_DOES_NOT_EXIST;
    case 'Failed to remove branch.':
      return ERROR_MESSAGE_REMOVE_BRANCH_FAILED;
    case 'Environment not found.':
      return ERROR_MESSAGE_ENVIRONMENT_NOT_FOUND;
    case 'No current branch.':
      return ERROR_MESSAGE_NO_CURRENT_BRANCH;
    case 'Environment type should be remote.':
      return ERROR_MESSAGE_WRONG_ENVIRONMENT_TYPE;
    case 'No destination branch.':
      return ERROR_MESSAGE_NO_DESTINATION_BRANCH;
    default:
      return error;
  }
}

module.exports = {
  getBranches,
  deleteBranch,
  createBranch,
  pushBranch,
  switchBranch,
  handleBranchError,
};
