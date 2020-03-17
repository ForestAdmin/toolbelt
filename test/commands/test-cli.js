const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');
const { expect } = require('chai');

module.exports = async function testCli({
  nock, env, inputs, command, outputs, errorOutputs,
}) {
  const previousEnv = process.env;
  if (env) process.env = env;

  const stdin = mockStdin.stdin();

  for (let i = 0; i < inputs.length; i += 1) {
    setTimeout(() => stdin.send(inputs[i]), 500 + i * 100);
  }

  stdout.start();
  stderr.start();
  await command();
  nock && nock.done();
  stdin.end();
  stdin.reset();
  stdout.stop();
  stderr.stop();

  if (outputs) {
    for (let i = 0; i < outputs.length; i += 1) {
      expect(stdout.output).to.contain(outputs[i]);
    }
  }

  if (errorOutputs) {
    for (let i = 0; i < errorOutputs.length; i += 1) {
      expect(stderr.output).to.contain(errorOutputs[i]);
    }
  }

  process.env = previousEnv;
};
