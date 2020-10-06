const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');

module.exports = {
  mockStd: (outputs, errorOutputs, print) => {
    stdout.previousPrint = stdout.print;
    stderr.previousPrint = stderr.print;
    stdout.print = print;
    stderr.print = print;
    const stdin = mockStdin.stdin();
    if (outputs.length) stdout.start();
    if (errorOutputs.length) stderr.start();
    return stdin;
  },
  planifyInputs: (inputs, stdin) => {
    for (let i = 0; i < inputs.length; i += 1) {
      // Smelly code...
      setTimeout(() => stdin.send(`${inputs[i]}\n`), 1000 + i * 100);
    }
  },
  assertOutputs: (outputs, errorOutputs) => {
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
  rollbackStd: (stdin, inputs, outputs, errorOutputs) => {
    if (inputs.length) stdin.end();
    if (inputs.length) stdin.reset();
    if (outputs.length) stdout.stop();
    if (errorOutputs.length) stderr.stop();

    stdout.print = stdout.previousPrint;
    stderr.print = stderr.previousPrint;
    stdout.previousPrint = null;
    stderr.previousPrint = null;
  },
};
