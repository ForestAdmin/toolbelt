const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');
const { expect } = require('chai');

module.exports = async function testCli({
    nock, env, command, dialog,
  }) {
  const inputs = dialog ? dialog.filter((type) => type.in).map((type) => type.in) : [];
  const outputs = dialog ? dialog.filter((type) => type.out).map((type) => type.out) : [];
  const errorOutputs = dialog ? dialog.filter((type) => type.err).map((type) => type.err) : [];
  const previousEnv = process.env;
  if (env) process.env = env;

  const stdin = mockStdin.stdin();

  for (let i = 0; i < inputs.length; i += 1) {
    setTimeout(() => stdin.send(`${inputs[i]}\n`), 500 + i * 100);
  }

  stdout.start();
  stderr.start();
  await command();
  nock && nock.done();
  stdin.end();
  stdin.reset();
  stdout.stop();
  stderr.stop();

  for (let i = 0; i < outputs.length; i += 1) {
    expect(stdout.output).to.contain(outputs[i]);
  }

  for (let i = 0; i < errorOutputs.length; i += 1) {
    expect(stderr.output).to.contain(errorOutputs[i]);
  }

  process.env = previousEnv;
};
