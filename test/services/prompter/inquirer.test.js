const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');

const TIME_TO_LOAD_TEST = 2000;
const TIME_TO_REACH_NEXT_PROMPT = 100;

describe('inquirer', () => {

});

const utils = {
  mockStd: (outputs, errorOutputs, print) => {
    stdout.previousPrint = stdout.print;
    stderr.previousPrint = stderr.print;
    stdout.print = print;
    stderr.print = print;
    const stdin = mockStdin.stdin();
    if (outputs.length) stdout.start();
    stderr.start();
    return stdin;
  },
  /**
   * @param {string[]} inputs
   * @param {import('mock-stdin').MockSTDIN} stdin
   */
  planifyInputs: (inputs, stdin) => {
    for (let i = 0; i < inputs.length; i += 1) {
      // WARNING: Smelly code..., could break if the test pre-loading time increases.
      setTimeout(() => stdin.send(`${inputs[i]}\n`), TIME_TO_LOAD_TEST + i * TIME_TO_REACH_NEXT_PROMPT);
    }
  },
  assertOutputs: (outputs, errorOutputs, { assertNoStdError }) => {
    stdout.stop();
    stderr.stop();

    if (!errorOutputs.length && stderr.output && assertNoStdError) {
      expect(stderr.output.trim()).toBe('');
    }

    for (let i = 0; i < outputs.length; i += 1) {
      const isString = typeof outputs[i] === 'string' || outputs[i] instanceof String;
      if (isString) {
        expect(stdout.output).toContain(outputs[i]);
      } else {
        const isJson = outputs[i].constructor === ({}).constructor
          || Array.isArray(outputs[i]);
        if (isJson) {
          expect(JSON.parse(stdout.output)).toStrictEqual(outputs[i]);
        }
      }
    }
    for (let i = 0; i < errorOutputs.length; i += 1) {
      expect(stderr.output).toContain(errorOutputs[i]);
    }
  },
  rollbackStd: (stdin, inputs, outputs) => {
    if (inputs.length) stdin.end();
    if (inputs.length) stdin.reset();
    if (outputs.length) stdout.stop();
    stderr.stop();

    stdout.print = stdout.previousPrint;
    stderr.print = stderr.previousPrint;
    stdout.previousPrint = null;
    stderr.previousPrint = null;
  },
  logStdErr: () => {
    process.stderr.write(stderr.output);
  },
  logStdOut: () => {
    process.stderr.write(stdout.output);
  },
};


const { init, getInstance } = require('@forestadmin/context');
const initContext = require('../../src/context/init');

init(initContext);

const {
  mockStd,
  planifyInputs,
  assertOutputs,
  rollbackStd,
  logStdErr,
  logStdOut,
} = utils;

function asArray(any) {
  if (!any) return [];
  return Array.isArray(any) ? any : [any];
}

async function testCli({
  exitMessage: expectedExitMessage,
  std: stds,
  assertNoStdError = true,
  print = false,
}) {

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
