const { stdout, stderr } = require('stdout-stderr');

module.exports = {
  mockStd: (outputs, errorOutputs, print) => {
    stdout.previousPrint = stdout.print;
    stderr.previousPrint = stderr.print;
    stdout.print = print;
    stderr.print = print;
    if (outputs.length) stdout.start();
    stderr.start();
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
  rollbackStd: (outputs) => {
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
