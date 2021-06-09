const nock = require('nock');

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
  assertPromptCalled,
} = require('./test-cli-errors');
const { prepareCommand } = require('./test-cli-command');
const { prepareContextPlan, restoreFromContext } = require('./test-cli-context');
const { assertApi } = require('./test-cli-api');
const {
  makeTempDirectory,
  mockFile,
  cleanMockedFile,
  randomDirectoryName,
} = require('./test-cli-fs');
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
    const spinnerOutputs = stds
      .filter((type) => type.spinner)
      // NOTICE: Spinnies uses '-' as prefix when in CI mode.
      .map((type) => (process.env.CI ? `-${type.spinner.slice(1)}` : type.spinner));
    errorOutputs = [...stds.filter((type) => type.err).map((type) => type.err), ...spinnerOutputs];
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

  const commandPlan = prepareContextPlan({
    env,
    inputs,
    promptCounts,
    tokenBehavior,
  });

  const stdin = mockStd(outputs, errorOutputs, print);

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
      await command.run();
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

  const { getInquirerCurrentPrompt } = restoreFromContext(command.context);
  const currentPrompt = getInquirerCurrentPrompt();

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
