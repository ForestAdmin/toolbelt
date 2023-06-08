const { makeAuthenticatorMock } = require('./mocks/plan-mocks');

const defaultPlan = require('../../../src/context/plan');

// FIXME: Need to override things here (fs...)

const replaceProcessFunctions = plan =>
  plan.replace('process/exit/exitProcess', exitCode => {
    const error = {
      message: `Unwanted "process.exit" call with exit code ${exitCode}`,
      oclif: {
        exit: exitCode,
      },
    };
    throw error;
  });

const makeEnvironmentVariablesReplacement = env => plan =>
  plan.replace('env/variables/env', {
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
    // FOREST_SERVER_URL: undefined,
    // NODE_ENV: undefined,
    // PORT: undefined,
    // TOKEN_PATH: undefined,
    // NOTICE: Makes test runner look for token in test temporary directory.
    TOKEN_PATH: process.cwd(),
    // FIXME: Overrides for this test.
    ...env,
  });

const jwtDecodeMock = jest.fn().mockImplementation(token => {
  if (token === '__invalid_token__') throw new Error('Invalid token');
  return token;
});

const makeDependenciesReplacement = () => plan =>
  plan
    .replace('dependencies/open/open', jest.fn())
    .replace('dependencies/jwtDecode/jwtDecode', jwtDecodeMock);

const makeAuthenticatorReplacement = tokenBehavior => {
  if (tokenBehavior === null) return plan => plan;
  return plan =>
    plan.replace('services/authenticator/authenticator', makeAuthenticatorMock(tokenBehavior));
};

const makeInquirerMock = prompts => {
  const dummyPrompt = jest.fn();
  prompts.forEach(prompt => {
    dummyPrompt.mockImplementationOnce(questions => {
      questions = Array.isArray(questions) ? questions : [questions];
      questions.forEach(question => question?.when?.({}));

      return prompt.out;
    });
  });
  return { prompt: dummyPrompt };
};

const makeInquirerReplacement = dummyInquirer => plan =>
  plan.replace('dependencies/inquirer/inquirer', dummyInquirer);

const preparePlan = ({ testCommandPlan, env, prompts, tokenBehavior, additionnalStep }) => {
  if (testCommandPlan) return { plan: testCommandPlan };
  const inquirerMock = makeInquirerMock(prompts);

  const authenticatorPlan = makeAuthenticatorReplacement(tokenBehavior);
  const dependenciesPlan = makeDependenciesReplacement();
  const environmentVariablesPlan = makeEnvironmentVariablesReplacement(env);
  const inquirerPlan = makeInquirerReplacement(inquirerMock);

  const mocks = {
    inquirer: inquirerMock,
    jwtDecode: jwtDecodeMock,
  };
  const plan = [
    defaultPlan,
    replaceProcessFunctions,
    environmentVariablesPlan,
    dependenciesPlan,
    inquirerPlan,
    authenticatorPlan,
  ];

  if (additionnalStep) plan.push(additionnalStep);

  return { mocks, plan };
};

module.exports = { preparePlan };
