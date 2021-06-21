const { getTokenPath } = require('./test-cli-auth-token');

const makeDefaultPlan = require('../../../src/context/init');
const { makeAuthenticatorPlanMock } = require('./mocks/plan-mocks');

// FIXME: Need to override things here (fs...)
const initialContextPlan = () => makeDefaultPlan();

const replaceProcessFunctions = ({ plan }) => plan
  .replace('process.exit', (context) => context.addFunction('exitProcess',
    (exitCode) => {
      console.error('exitProcess');
      console.trace();
      const error = {
        message: `Unwanted "process.exit" call with exit code ${exitCode}`,
        oclif: {
          exit: exitCode,
        },
      };
      throw error;
    }));

const replaceEnvironmentVariables = ({ plan, env }) => plan
  .replace('env.variables', (context) => context.addValue('env', {
    // FIXME: Default values.
    // APPLICATION_PORT: undefined,
    // CORS_ORIGIN: undefined,
    // DATABASE_REJECT_UNAUTHORIZED: undefined,
    // DATABASE_SCHEMA: undefined,
    // DATABASE_SSL: undefined,
    // DATABASE_URL: undefined,
    // FOREST_AUTH_SECRET: undefined,
    // FOREST_EMAIL: undefined,
    // FOREST_ENV_SECRET: undefined,
    // FOREST_PASSWORD: undefined,
    // FOREST_URL: undefined,
    // NODE_ENV: undefined,
    // PORT: undefined,
    TOKEN_PATH: getTokenPath(),
    // FIXME: Overrides for this test.
    ...env,
  }));

const replaceDependencies = ({ plan }) => plan
  .replace('dependencies.open',
    (context) => context.addFunction('open', jest.fn()));

const replaceAuthenticator = ({ plan, tokenBehavior }) => {
  if (tokenBehavior === null) return plan;
  return plan.replace(
    'services.authenticator',
    makeAuthenticatorPlanMock(tokenBehavior),
  );
};

const replaceInquirer = ({ plan, prompts }) => {
  const dummyPrompt = jest.fn();
  prompts.forEach((prompt) => dummyPrompt.mockReturnValueOnce(prompt.out));
  const dummyInquirer = {
    prompt: dummyPrompt,
  };

  return plan.replace('dependencies.inquirer',
    (context) => context
      .addInstance('inquirer', dummyInquirer));
};

const prepareContextPlan = (parameters) => [
  replaceProcessFunctions,
  replaceEnvironmentVariables,
  replaceDependencies,
  replaceAuthenticator,
  replaceInquirer,
].reduce((plan, next) => next({ ...parameters, plan }), initialContextPlan());

module.exports = { prepareContextPlan };
