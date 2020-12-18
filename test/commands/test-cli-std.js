const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');

const TIME_TO_LOAD_TEST = 2000;
const TIME_TO_REACH_NEXT_PROMPT = 100;

module.exports = {
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
  assertOutputs: (outputs, errorOutputs) => {
    stdout.stop();
    stderr.stop();

    if (!errorOutputs.length && stderr.output) {
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
