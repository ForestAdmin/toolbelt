const inquirer = require('inquirer');

const { getTokenPath } = require('./test-cli-auth-token');

const makeDefaultPlan = require('../../../src/context/init');

// FIXME: Need to override things here (fs...)
const initialContextPlan = () => makeDefaultPlan();

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
  return plan.replace('services.authenticator',
    (context) => context.addInstance('authenticator', {
      getAuthToken: () => tokenBehavior,
      login: () => { },
      logout: () => { },
      tryLogin: () => { },
    }));
};

const replaceInquirer = ({ inputs, plan, promptCounts }) => {
  const eol = '\r\n';
  const inquirerPrompt = inquirer.prompt;
  let inputIndex = 0;
  let currentPrompt = -1;

  inquirer.prompt = async (question, answers) => {
    const inquirerPromise = inquirerPrompt(question, answers);
    // Keep `input.send` reference to prevent rare issue with test killed early.
    const sendInput = inquirerPromise.ui.rl.input.send.bind(inquirerPromise.ui.rl.input);

    currentPrompt += 1;
    if (currentPrompt > promptCounts.length) throw new Error('Calling inquirer prompt more than expected');

    const currentPromptCount = promptCounts[currentPrompt];
    if (currentPromptCount > question.length) throw new Error(`Expecting ${currentPromptCount} prompts when inquirer has ${question.length} question(s)`);

    for (let i = 0; i < currentPromptCount; i += 1) {
      const answer = `${inputs[inputIndex]}${eol}`;
      setTimeout(() => sendInput(answer), 0);
      inputIndex += 1;
    }

    return inquirerPromise;
  };

  return plan.replace('dependencies.inquirer',
    (context) => context
      .addInstance('inquirer', inquirer)
      .addFunction('restoreInquirer', () => { inquirer.prompt = inquirerPrompt; })
      .addFunction('getInquirerCurrentPrompt', () => currentPrompt));
};

const prepareContextPlan = (parameters) => [
  replaceEnvironmentVariables,
  replaceDependencies,
  replaceAuthenticator,
  replaceInquirer,
].reduce((plan, next) => next({ ...parameters, plan }), initialContextPlan());

const restoreFromContext = (context) => {
  const { restoreInquirer, getInquirerCurrentPrompt } = context;

  restoreInquirer();

  return {
    getInquirerCurrentPrompt,
  };
};

module.exports = { prepareContextPlan, restoreFromContext };
