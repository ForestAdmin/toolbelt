const { assertExitCode, assertExitMessage } = require('./test-cli-errors');
const { mockEnv, rollbackEnv } = require('./test-cli-env');
const { assertApi } = require('./test-cli-api');
const { mockFile } = require('./test-cli-fs');
const { mockToken, rollbackToken } = require('./test-cli-auth-token');
const { validateInput } = require('./test-cli-errors');
const {
  mockStd,
  planifyInputs,
  assertOutputs,
  rollbackStd,
} = require('./test-cli-std');

function asArray(any) {
  if (!any) return [];
  return Array.isArray(any) ? any : [any];
}

async function testCli({
  file,
  api,
  env,
  command,
  exitCode: expectedExitCode,
  exitMessage: expectedExitMessage,
  std: stds,
  print = false,
  token: tokenBehavior = null,
  ...rest
}) {
  validateInput(file, command, stds, expectedExitCode, expectedExitMessage, rest);
  const nocks = asArray(api);
  const inputs = stds ? stds.filter((type) => type.in).map((type) => type.in) : [];
  const outputs = stds ? stds.filter((type) => type.out).map((type) => type.out) : [];
  const errorOutputs = stds ? stds.filter((type) => type.err).map((type) => type.err) : [];

  mockFile(file);
  mockEnv(env);
  mockToken(tokenBehavior);
  const stdin = mockStd(outputs, errorOutputs, print);
  planifyInputs(inputs, stdin);

  let actualError;
  try {
    await command();
  } catch (error) {
    actualError = error;
  }

  assertApi(nocks);
  assertExitCode(actualError, expectedExitCode);
  assertExitMessage(actualError, expectedExitMessage);
  assertOutputs(outputs, errorOutputs);

  rollbackStd(stdin, inputs, outputs, errorOutputs);
  rollbackEnv(env);
  rollbackToken(tokenBehavior);
}

module.exports = testCli;
