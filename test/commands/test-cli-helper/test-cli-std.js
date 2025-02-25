const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');

module.exports = {
  mockStd: (outputs, errorOutputs, print) => {
    stdout.previousPrint = stdout.print;
    stdout.print = print;
    if (outputs.length) stdout.start();

    stderr.previousPrint = stderr.print;
    stderr.print = print;
    stderr.start();

    const stdin = mockStdin.stdin();
    return stdin;
  },
  assertOutputs: (outputs, errorOutputs, { assertNoStdError }) => {
    stdout.stop();
    stderr.stop();

    if (!errorOutputs.length && stderr.output && assertNoStdError) {
      if (stderr.output.trim().length > 0) {
        expect(stderr.output.trim()).toContain('DeprecationWarning');
      } else {
        expect(stderr.output.trim()).toBe('');
      }
    }

    for (let i = 0; i < outputs.length; i += 1) {
      const isString = typeof outputs[i] === 'string' || outputs[i] instanceof String;
      if (isString) {
        expect(stdout.output).toContain(outputs[i]);
      } else {
        const isJson = outputs[i].constructor === {}.constructor || Array.isArray(outputs[i]);
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
