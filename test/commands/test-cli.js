const nock = require('nock');

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
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
  planifyInputs,
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

  validateInput(
    files,
    { commandClass, commandArgs },
    stds,
    expectedExitCode,
    expectedExitMessage,
    rest,
  );

  const inputs = stds ? stds.filter((type) => type.in).map((type) => type.in) : [];
  const outputs = stds ? stds.filter((type) => type.out).map((type) => type.out) : [];
  let errorOutputs;
  if (stds) {
    // NOTICE: spinnies outputs to std.err
    errorOutputs = stds
      .filter((type) => type.err || type.spinner)
      .map((type) => type.err || type.spinner);
  } else {
    errorOutputs = [];
  }

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

  if (tokenBehavior != null) {
    commandPlan = commandPlan.replace('services.authenticator',
      (context) => context.addInstance('authenticator', {
        getAuthToken: () => tokenBehavior,
        login: () => { },
        logout: () => { },
        tryLogin: () => { },
      }));
  }

  const stdin = mockStd(outputs, errorOutputs, print);
  planifyInputs(inputs, stdin);

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

  try {
    assertNoErrorThrown(actualError, expectedExitCode, expectedExitMessage);
    assertApi(nocks);
    assertExitCode(actualError, expectedExitCode);
    assertExitMessage(actualError, expectedExitMessage);
    assertOutputs(outputs, errorOutputs, { assertNoStdError });
  } catch (e) {
    logStdErr();
    logStdOut();
    throw e;
  }
}

module.exports = testCli;
