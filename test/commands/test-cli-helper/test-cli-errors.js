const AbstractCommand = require('../../../src/abstract-command').default;

function errorIfBadFile(file) {
  if (!file) return;
  const { chdir, directory, name, content, temporaryDirectory, ...rest } = file;
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
  files.forEach(file => errorIfBadFile(file));
}

function errorIfBadPrompts(prompts) {
  prompts.forEach(prompt => {
    if (!Array.isArray(prompt.in) || prompt.in.length === 0) {
      throw new Error('Prompt input undefined or empty');
    }
    prompt.in.forEach(input => {
      if (['confirm', 'input', 'list', 'password'].indexOf(input.type) === -1) {
        throw new Error(`Invalid prompt type "${input.type}"`);
      }
    });
  });
}

function errorIfRest(rest) {
  if (Object.keys(rest).length > 0) {
    throw new Error(`Unknown testCli parameter(s): ${Object.keys(rest).join(', ')}.
    Valids are: env, token, command, api, std, exitCode, exitMessage`);
  }
}

function errorIfStdRest(stds) {
  const valids = ['in', 'out', 'err', 'spinner'];
  const rest = stds.filter(
    type => !valids.find(valid => Object.prototype.hasOwnProperty.call(type, valid)),
  );
  if (rest.length > 0) {
    throw new Error(`testCli configuration error: Invalid "std" attribute(s).
      Valids are: ${valids.join(', ')}`);
  }
}

function errorIfBadCommand({ commandClass, commandArgs, commandPlan, additionnalStep }) {
  if (commandClass) {
    if (!(commandClass.prototype instanceof AbstractCommand)) {
      throw new Error('"commandClass" must inherit "AbstractCommand"');
    }
    if (commandArgs && !Array.isArray(commandArgs)) {
      throw new Error('"commandArgs" must be an array');
    }
    // commandClass+commandArgs are valid
  } else if (!commandPlan) {
    throw new Error('commandClass must defined');
  }
  if (additionnalStep && typeof additionnalStep !== 'function') {
    throw new Error('additionnalStep must be a function');
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
  { commandClass, commandArgs, commandPlan, additionnalStep },
  stds,
  prompts,
  expectedExitCode,
  expectedExitMessage,
  rest,
) {
  errorIfBadFiles(files);
  errorIfBadPrompts(prompts);
  errorIfRest(rest);
  errorIfBadCommand({
    commandClass,
    commandArgs,
    commandPlan,
    additionnalStep,
  });
  const noExitExpected =
    (expectedExitCode === null || expectedExitCode === undefined) && !expectedExitMessage;
  if (stds || noExitExpected) {
    errorIfNoStd(stds);
    errorIfStdRest(stds);
  }
}

// NOTICE: Assert that command did not throw an error if there is no expected error.
function assertNoErrorThrown(actualError, expectedExitCode, expectedExitMessage) {
  if (expectedExitCode || expectedExitMessage) return;
  if (actualError) {
    actualError.message = `The following error was thrown by command.
    \n   Since no "exitCode" and/or "exitMessage" is specified, no error should not be thrown.
    \n ${actualError.message}`;
    throw actualError;
  }
}

function assertExitCode(actualError, expectedExitCode) {
  if (!expectedExitCode) return;

  const actualExitCode = (actualError && actualError.oclif && actualError.oclif.exit) || -1;
  const actualMessage = actualError ? `Exit code: '${actualExitCode}'` : 'No exit code.';

  expect(actualMessage).toStrictEqual(`Exit code: '${expectedExitCode}'`);
}

function assertExitMessage(actualError, expectedExitMessage) {
  if (!expectedExitMessage) return;

  const actualMessage = actualError
    ? `Error message: '${actualError.message}'`
    : 'No error message.';

  expect(actualMessage).toStrictEqual(`Error message: '${expectedExitMessage}'`);
}

function assertPromptCalled(prompts, inquirer) {
  expect(inquirer.prompt).toHaveBeenCalledTimes(prompts.length);

  for (let i = 0; i < prompts.length; i += 1) {
    // inquirer.prompt can be called with a second parameter.
    try {
      expect(inquirer.prompt).toHaveBeenNthCalledWith(i + 1, prompts[i].in, expect.anything());
    } catch {
      expect(inquirer.prompt).toHaveBeenNthCalledWith(i + 1, prompts[i].in);
    }
  }
}

module.exports = {
  validateInput,
  assertExitCode,
  assertExitMessage,
  assertNoErrorThrown,
  assertPromptCalled,
};
