const AbstractCommand = require('../../../src/abstract-command');

function errorIfBadFile(file) {
  if (!file) return;
  const {
    chdir, directory, name, content, temporaryDirectory, ...rest
  } = file;
  if (Object.keys(rest).length > 0) {
    throw new Error(`Unknown testCli.file parameter(s): ${Object.keys(rest).join(', ')}.
    Valids are: chdir, name, content`);
  }
  if (!chdir && !name && !content && !directory) {
    throw new Error('testCli.file must contain at least chdir and/or name,content');
  }
  if (name && directory) {
    throw new Error('define testCli.directory OR testCli.name');
  }
  const missingContent = content === null || content === undefined;
  if ((!name && content) || (name && missingContent)) {
    throw new Error('testCli.file name AND content must be defined');
  }
  if (temporaryDirectory !== undefined && typeof temporaryDirectory !== 'boolean') {
    throw new Error('testCli.temporaryDirectory must be a boolean value if specified');
  }
}

function errorIfBadFiles(files) {
  files.forEach((file) => errorIfBadFile(file));
}

function errorIfBadPromptCounts(promptCounts, inputs) {
  if (promptCounts === null) return;
  if (promptCounts !== undefined && !Array.isArray(promptCounts)) {
    throw new Error('"promptCounts" not defined as an array');
  }
  let expectedPromptCount = 0;
  if (promptCounts) {
    expectedPromptCount = promptCounts.reduce((prev, cur) => prev + cur, 0);
  }
  if (expectedPromptCount !== inputs.length) {
    throw new Error(`got ${inputs.length} input string for an expected total of ${expectedPromptCount}`);
  }
}

function errorIfRest(rest) {
  if (Object.keys(rest).length > 0) {
    throw new Error(`Unknown testCli parameter(s): ${Object.keys(rest).join(', ')}.
    Valids are: env, token, command, api, std, exitCode, exitMessage`);
  }
}

function errorIfStdRest(stds) {
  const valids = ['in', 'out', 'err', 'spinner'];
  const rest = stds.filter((type) =>
    !valids.find((valid) =>
      Object.prototype.hasOwnProperty.call(type, valid)));
  if (rest.length > 0) {
    throw new Error(`testCli configuration error: Invalid "std" attribute(s).
      Valids are: ${valids.join(', ')}`);
  }
}

function errorIfBadCommand({ commandClass, commandArgs }) {
  if (commandClass) {
    if (!(commandClass.prototype instanceof AbstractCommand)) {
      throw new Error('"commandClass" must inherit "AbstractCommand"');
    }
    if (commandArgs && !Array.isArray(commandArgs)) {
      throw new Error('"commandArgs" must be an array');
    }
    // commandClass+commandArgs are valid
  } else {
    throw new Error('commandClass must defined');
  }
}

function errorIfNoStd(stds) {
  if (!stds || !Array.isArray(stds) || !stds.length > 0) {
    throw new Error(
      // eslint-disable-next-line no-multi-str
      'testCli configuration error: "std" or "exitCode" or "exitMessage" must be \
      defined.\n \
      "std" must be a not empty array like [{in:\'john\'},{out:\'hello, john\'}]\n \
      Define "exitCode" and/or "exitMessage" instead of "std" if you are testing an error \
      case.',
    );
  }
}

function validateInput(
  files,
  { commandLegacy, commandClass, commandArgs },
  stds,
  inputs,
  promptCounts,
  expectedExitCode,
  expectedExitMessage,
  rest,
) {
  errorIfBadFiles(files);
  errorIfBadPromptCounts(promptCounts, inputs);
  errorIfRest(rest);
  errorIfBadCommand({ commandLegacy, commandClass, commandArgs });
  const noExitExpected = (expectedExitCode === null || expectedExitCode === undefined)
    && !expectedExitMessage;
  if (stds || noExitExpected) {
    errorIfNoStd(stds);
    errorIfStdRest(stds);
  }
}

// NOTICE: Assert that command did not throw an error if there is no expected error.
function assertNoErrorThrown(actualError, expectedExitCode, expectedExitMessage) {
  if (expectedExitCode || expectedExitMessage) return;

  // eslint-disable-next-line no-multi-str
  const noErrorMessage = 'Unexpected error thrown by command.\n \
   No "exitCode" and/or "exitMessage" is specified, so this error should not be thrown.';
  // FIXME: show the error stack
  const message = actualError || noErrorMessage;
  expect(message).toStrictEqual(noErrorMessage);
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

function assertPromptCalled(prompts, lastPromptIndex) {
  const expectedCurrentPrompt = ((prompts && prompts.length) || 0) - 1;

  expect(lastPromptIndex).toBe(expectedCurrentPrompt);
}

module.exports = {
  validateInput,
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
  assertPromptCalled,
};
