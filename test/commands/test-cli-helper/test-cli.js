const nock = require('nock');

const {
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
  assertPromptCalled,
} = require('./test-cli-errors');
const { prepareCommand } = require('./test-cli-command');
const { preparePlan } = require('./test-cli-context');
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

function filterStds(stds) {
  const inputs = stds ? stds.filter((type) => type.in !== undefined).map((type) => type.in) : [];
  const outputs = stds ? stds.filter((type) => type.out !== undefined).map((type) => type.out) : [];
  let errorOutputs;
  if (stds) {
    // NOTICE: spinnies outputs to std.err
    const spinnerOutputs = stds
      .filter((type) => type.spinner)
      // NOTICE: Spinnies uses '-' as prefix when in CI mode.
      .map((type) => ((process.env.CI || (process.stderr && !process.stderr.isTTY)) ? `-${type.spinner.slice(1)}` : type.spinner));
    errorOutputs = [...stds.filter((type) => type.err).map((type) => type.err), ...spinnerOutputs];
  } else {
    errorOutputs = [];
  }
  return { inputs, outputs, errorOutputs };
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
  commandPlan: testCommandPlan,
  additionnalStep,
  exitCode: expectedExitCode,
  exitMessage: expectedExitMessage,
  prompts = [],
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

  const { inputs, outputs, errorOutputs } = filterStds(stds);

  validateInput(
    files,
    {
      commandClass, commandArgs, commandPlan: testCommandPlan, additionnalStep,
    },
    stds,
    prompts,
    expectedExitCode,
    expectedExitMessage,
    rest,
  );

  const oldcwd = process.cwd();
  makeTempDirectory(temporaryDirectory);
  // WARNING: Keep this BEFORE context construction. Current directory will be included.
  process.chdir(temporaryDirectory);
  files.forEach((file) => mockFile(file));

  const stdin = mockStd(outputs, errorOutputs, print);

  const { plan: commandPlan, mocks } = preparePlan({
    testCommandPlan,
    env,
    inputs,
    prompts,
    tokenBehavior,
    additionnalStep,
  });

  let command;
  try {
    command = prepareCommand({
      commandArgs,
      commandClass,
      commandPlan,
    });
  } catch (error) {
    rollbackStd(stdin, inputs, outputs);
    throw error;
  }

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
    cleanMockedFile({ directory: temporaryDirectory });
  }
  process.chdir(oldcwd);

  try {
    assertExitCode(actualError, expectedExitCode);
    assertExitMessage(actualError, expectedExitMessage);
    assertNoErrorThrown(actualError, expectedExitCode, expectedExitMessage);
    if (mocks) assertPromptCalled(prompts, mocks.inquirer);
    assertOutputs(outputs, errorOutputs, { assertNoStdError });
    assertApi(nocks);
  } catch (e) {
    logStdErr();
    logStdOut();
    throw e;
  }
}

module.exports = testCli;
