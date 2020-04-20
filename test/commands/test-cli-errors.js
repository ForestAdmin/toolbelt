const _ = require('lodash');

function errorIfBadFile(file) {
  if (!file) return;
  const {
    chdir, name, content, ...rest
  } = file;
  if (Object.keys(rest).length > 0) {
    throw new Error(`Unknown testCli.file parameter(s): ${Object.keys(rest).join(', ')}.
    Valids are: chdir, name, content`);
  }
  if (!chdir && !name && !content) {
    throw new Error('testCli.file must contain at least chdir and/or name,content');
  }
  if ((!name && content) || (name && !content)) {
    throw new Error('testCli.file name AND content must be defined');
  }
}

function errorIfRest(rest) {
  if (Object.keys(rest).length > 0) {
    throw new Error(`Unknown testCli parameter(s): ${Object.keys(rest).join(', ')}.
    Valids are: env, token, command, api, std, exitCode, exitMessage`);
  }
}

function errorIfStdRest(stds) {
  const valids = ['in', 'out', 'err'];
  const rest = stds.filter((type) =>
    !valids.find((valid) =>
      Object.prototype.hasOwnProperty.call(type, valid)));
  if (rest.length > 0) {
    throw new Error(`testCli configuration error: Invalid "std" attribute(s). 
      Valids are: ${valids.join(', ')}`);
  }
}

function errorIfBadCommand(command) {
  if (!command || !_.isFunction(command)) {
    throw new Error('testCli configuration error: "command" must be a function ex.'
      + ' () => GetCommand.run([\'324\'])');
  }
}

function errorIfNoStd(stds) {
  if (!stds || !Array.isArray(stds) || !stds.length > 0) {
    throw new Error('testCli configuration error: "std" must be an not empty array ex.'
      + ' [{in:\'john\'},{out:\'hello, john\'}]');
  }
}

function validateInput(file, command, stds, expectedExitCode, expectedExitMessage, rest) {
  errorIfBadFile(file);
  errorIfRest(rest);
  errorIfBadCommand(command);
  const noExitExpected = !expectedExitCode && !expectedExitMessage;
  if (stds || noExitExpected) {
    errorIfNoStd(stds);
    errorIfStdRest(stds);
  }
}

function assertExitCode(actualError, expectedExitCode) {
  if (!expectedExitCode) return;

  const actualMessage = actualError
    ? `Exit code: '${actualError.oclif.exit}'`
    : 'No exit code.';

  expect(actualMessage).toStrictEqual(`Exit code: '${expectedExitCode}'`);
}

function assertExitMessage(actualError, expectedExitMessage) {
  if (!expectedExitMessage) return;

  const actualMessage = actualError
    ? `Error message: '${actualError.message}'`
    : 'No error message.';

  expect(actualMessage).toStrictEqual(`Error message: '${expectedExitMessage}'`);
}

module.exports = {
  validateInput,
  assertExitCode,
  assertExitMessage,
};
