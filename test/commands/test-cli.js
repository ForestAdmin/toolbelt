const { init, getInstance } = require('@forestadmin/context');
const initContext = require('../../src/context/init');

init(initContext);

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
} = require('./test-cli-errors');
const { mockEnv, rollbackEnv } = require('./test-cli-env');
const { assertApi } = require('./test-cli-api');
const { mockFile, cleanMockedFile, randomDirectoryName } = require('./test-cli-fs');
const { mockToken, rollbackToken } = require('./test-cli-auth-token');
const { validateInput } = require('./test-cli-errors');
const {
  mockStd,
  planifyInputs,
  assertOutputs,
  rollbackStd,
  logStdErr,
  logStdOut,
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
  command,
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

  validateInput(file, command, stds, expectedExitCode, expectedExitMessage, rest);
  const nocks = asArray(api);
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
  mockEnv(env);
  mockToken(tokenBehavior);
  mockDependencies(getInstance());
  const stdin = mockStd(outputs, errorOutputs, print);
  planifyInputs(inputs, stdin);

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

  rollbackEnv(env);
  rollbackToken(tokenBehavior);
}

module.exports = testCli;
