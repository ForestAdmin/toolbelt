const nock = require('nock');

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
} = require('./test-cli-errors');
const { prepareCommand, prepareContext, prepareContextPlan } = require('./test-cli-command');
const { assertApi } = require('./test-cli-api');
const { mockFile, cleanMockedFile, randomDirectoryName } = require('./test-cli-fs');
const { getTokenPath, mockToken, rollbackToken } = require('./test-cli-auth-token');
const { validateInput } = require('./test-cli-errors');
const {
  assertOutputs,
  logStdErr,
  logStdOut,
  mockStd,
  planifyInputs,
  rollbackStd,
} = require('./test-cli-std');
const { mockDependencies } = require('./test-cli-dependencies');

function asArray(any) {
  if (!any) return [];
  return Array.isArray(any) ? any : [any];
}

/**
 * @param {{
 *  file?: any;
 *  api?: import('nock').Scope|Array<import('nock').Scope>,
 *  env?: any;
 *  command: () => PromiseLike<any>;
 *  exitCode?: number;
 *  exitMessage?: string;
 *  std?: Array<{in?: string; out?: string; err?: string; spinner?: string}>
 *  assertNoStdError?: boolean;
 *  print?: boolean;
 *  token?: string;
 * }} params
 */
async function testCli({
  file,
  api,
  env,
  command: commandLegacy,
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
  // NOTICE: Ensure a unique temporary directory is created.
  //         If a `file` is not given, or if no directory (`chdir`) is specified.
  if (!file) file = {};
  if (file && !file.chdir) {
    file.chdir = randomDirectoryName();
    file.temporaryDirectory = true;
  }

  validateInput(
    file,
    { commandLegacy, commandClass, commandArgs },
    stds,
    expectedExitCode,
    expectedExitMessage,
    rest,
  );

  const nocks = asArray(api);
  nock.disableNetConnect();
  nocks.forEach((nockFlow) => nockFlow());

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

  mockFile(file);

  const commandPlan = prepareContextPlan({ commandLegacy });

  commandPlan.step('env').replace('variables', (context) => context.addValue('env', {
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

  const context = prepareContext({ commandLegacy, commandPlan });

  mockToken(tokenBehavior, context);
  const stdin = mockStd(outputs, errorOutputs, print);
  planifyInputs(inputs, stdin);
  mockDependencies(context);

  const command = prepareCommand({
    commandArgs,
    commandClass,
    commandLegacy,
    context,
  });

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

  cleanMockedFile(file);
  rollbackToken(tokenBehavior, context);

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
