const inquirer = require('inquirer');
const nock = require('nock');

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
  assertPromptCalled,
} = require('./test-cli-errors');
const { prepareCommand, prepareContextPlan } = require('./test-cli-command');
const { assertApi } = require('./test-cli-api');
const {
  makeTempDirectory,
  mockFile,
  cleanMockedFile,
  randomDirectoryName,
} = require('./test-cli-fs');
const { getTokenPath } = require('./test-cli-auth-token');
const { validateInput } = require('./test-cli-errors');
const {
  assertOutputs,
  logStdErr,
  logStdOut,
  mockStd,
  rollbackStd,
} = require('./test-cli-std');

function asArray(any) {
  if (!any) return [];
  return Array.isArray(any) ? any : [any];
}

/**
 * @param {{
 *  file?: any;
 *  api?: import('nock').Scope|Array<import('nock').Scope>,
 *  env?: any;
 *  exitCode?: number;
 *  exitMessage?: string;
 *  std?: Array<{in?: string; out?: string; err?: string; spinner?: string}>
 *  assertNoStdError?: boolean;
 *  print?: boolean;
 *  token?: string;
 * }} params
 */
async function testCli({
  files,
  api,
  env,
  commandClass,
  commandArgs,
  exitCode: expectedExitCode,
  exitMessage: expectedExitMessage,
  promptCounts,
  std: stds,
  assertNoStdError = true,
  print = false,
  token: tokenBehavior = null,
  ...rest
}) {
  if (!files) files = [];
  const temporaryDirectory = randomDirectoryName();
  files.forEach((file) => {
    if (!file.chdir) {
      file.chdir = temporaryDirectory;
      file.temporaryDirectory = true;
    }
  });

  const inputs = stds ? stds.filter((type) => type.in !== undefined).map((type) => type.in) : [];
  const outputs = stds ? stds.filter((type) => type.out !== undefined).map((type) => type.out) : [];
  let errorOutputs;
  if (stds) {
    // NOTICE: spinnies outputs to std.err
    errorOutputs = stds
      .filter((type) => type.err || type.spinner)
      .map((type) => type.err || type.spinner);
  } else {
    errorOutputs = [];
  }

  validateInput(
    files,
    { commandClass, commandArgs },
    stds,
    inputs,
    promptCounts,
    expectedExitCode,
    expectedExitMessage,
    rest,
  );

  const oldcwd = process.cwd();
  makeTempDirectory(temporaryDirectory);
  process.chdir(temporaryDirectory);
  files.forEach((file) => mockFile(file));

  let commandPlan = prepareContextPlan()
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
    }))
    .replace('dependencies.open',
      (context) => context.addFunction('open', jest.fn()));

  const stdin = mockStd(outputs, errorOutputs, print);

  // Mock part of module inquirer to handle stdin
  let inputIndex = 0;
  let currentPrompt = -1;
  const eol = '\r\n';
  const inquirerPrompt = inquirer.prompt;

  inquirer.prompt = async (question, answers) => {
    const inquirerPromise = inquirerPrompt(question, answers);

    currentPrompt += 1;
    if (currentPrompt > promptCounts.length) throw new Error('Calling inquirer prompt more than expected');

    const currentPromptCount = promptCounts[currentPrompt];
    if (currentPromptCount > question.length) throw new Error(`Expecting ${currentPromptCount} prompts when inquirer has ${question.length} question(s)`);

    for (let i = 0; i < currentPromptCount; i += 1) {
      const answer = `${inputs[inputIndex]}${eol}`;
      setTimeout(() => inquirerPromise.ui.rl.input.send(answer), 0);
      inputIndex += 1;
    }

    return inquirerPromise;
  };
  commandPlan.replace('dependencies.inquirer',
    (context) => context.addInstance('requirer', inquirer));

  if (tokenBehavior != null) {
    commandPlan = commandPlan.replace('services.authenticator',
      (context) => context.addInstance('authenticator', {
        getAuthToken: () => tokenBehavior,
        login: () => { },
        logout: () => { },
        tryLogin: () => { },
      }));
  }

  const command = prepareCommand({
    commandArgs,
    commandClass,
    commandPlan,
  });

  nock.disableNetConnect();
  const nocksToStart = asArray(api);
  const nocks = nocksToStart.map((nockFlow) => nockFlow());

  let actualError;
  try {
    try {
      await command();
    } finally {
      rollbackStd(stdin, inputs, outputs);
    }
  } catch (error) {
    actualError = error;
    if (!expectedExitCode) {
      logStdErr();
    }
  }

  if (!process.env.KEEP_TEMPORARY_FILES) {
    files.forEach((file) => cleanMockedFile(file));
  }
  process.chdir(oldcwd);

  // Restore inquirer.
  inquirer.prompt = inquirerPrompt;

  try {
    assertNoErrorThrown(actualError, expectedExitCode, expectedExitMessage);
    assertApi(nocks);
    assertExitCode(actualError, expectedExitCode);
    assertExitMessage(actualError, expectedExitMessage);
    assertPromptCalled(promptCounts, currentPrompt);
    assertOutputs(outputs, errorOutputs, { assertNoStdError });
  } catch (e) {
    logStdErr();
    logStdOut();
    throw e;
  }
}

module.exports = testCli;
