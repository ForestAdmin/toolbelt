const { getTokenPath } = require('./test-cli-auth-token');

const defaultPlan = require('../../../src/context/plan');
const { makeAuthenticatorPlanMock } = require('./mocks/plan-mocks');

// FIXME: Need to override things here (fs...)

const replaceProcessFunctions = ({ plan }) => plan
  .replace('process.exit', (context) => context.addFunction('exitProcess',
    (exitCode) => {
      const error = {
        message: `Unwanted "process.exit" call with exit code ${exitCode}`,
        oclif: {
          exit: exitCode,
        },
      };
      throw error;
    }));

const makeEnvironmentVariablesReplacement = (env) => (plan) => plan
  .replace('env/variables/env', {
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
  });

const makeDependenciesReplacement = () => (plan) => plan
  .replace('dependencies/open/open', jest.fn());

const makeAuthenticatorReplacement = (tokenBehavior) => (plan) => {
  if (tokenBehavior === null) return plan;
  return plan.replace(
    'services/authenticator',
    makeAuthenticatorPlanMock(tokenBehavior),
  );
};

const makeInquirerMock = (prompts) => {
  const dummyPrompt = jest.fn();
  prompts.forEach((prompt) => dummyPrompt.mockReturnValueOnce(prompt.out));
  return { prompt: dummyPrompt };
};

const makeInquirerReplacement = (dummyInquirer) => (plan) => plan
  .replace('dependencies/inquirer/inquirer', dummyInquirer);

const preparePlan = ({
  env,
  prompts,
  tokenBehavior,
}) => {
  const environmentVariablesPlan = makeEnvironmentVariablesReplacement(env);
  const dependenciesPlan = makeDependenciesReplacement();
  const inquirerMock = makeInquirerMock(prompts);
  const inquirerPlan = makeInquirerReplacement(inquirerMock);
  const authenticatorPlan = makeAuthenticatorReplacement(tokenBehavior);

  return {
    mocks: {
      inquirer: inquirerMock,
    },
    plan: [
      defaultPlan,
      replaceProcessFunctions,
      environmentVariablesPlan,
      dependenciesPlan,
      inquirerPlan,
      authenticatorPlan,
    ],
  };
};

module.exports = { preparePlan };
