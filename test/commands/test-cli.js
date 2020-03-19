const mockStdin = require('mock-stdin');
const { stdout, stderr } = require('stdout-stderr');
const { expect } = require('chai');

const asArray = (any) => {
  if (!any) return [];
  return Array.isArray(any) ? any : [any];
};

module.exports = async function testCli({
  nock, env, command, dialog, print = false,
}) {
  stdout.print = print;
  stderr.print = print;
  const nocks = asArray(nock);
  const inputs = dialog ? dialog.filter((type) => type.in).map((type) => type.in) : [];
  const outputs = dialog ? dialog.filter((type) => type.out).map((type) => type.out) : [];
  const errorOutputs = dialog ? dialog.filter((type) => type.err).map((type) => type.err) : [];
  const previousEnv = process.env;
  if (env) process.env = env;

  const stdin = mockStdin.stdin();

  for (let i = 0; i < inputs.length; i += 1) {
    setTimeout(() => stdin.send(`${inputs[i]}\n`), 500 + i * 100);
  }

  if (outputs.length) stdout.start();
  if (errorOutputs.length) stderr.start();
  await command();
  nocks.forEach((item) => item.done());
  if (inputs.length) stdin.end();
  if (inputs.length) stdin.reset();
  if (outputs.length) stdout.stop();
  if (errorOutputs.length) stderr.stop();

  for (let i = 0; i < outputs.length; i += 1) {
    expect(stdout.output).to.contain(outputs[i]);
  }

  for (let i = 0; i < errorOutputs.length; i += 1) {
    expect(stderr.output).to.contain(errorOutputs[i]);
  }

  process.env = previousEnv;
};
