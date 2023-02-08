const inquirer = require('inquirer');
const mockStdin = require('mock-stdin');
const { stdout } = require('stdout-stderr');

describe('inquirer', () => {
  function startMock() {
    stdout.start();
    return mockStdin.stdin();
  }
  function send(stdin, answer) {
    stdin.send(`${answer}\n`);
  }
  function stopMock() {
    stdout.stop();
  }

  describe('confirm', () => {
    it('should confirm', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          type: 'confirm',
          name: 'The confirm question name',
          message: 'Is the confirm prompt working?',
        },
      ]);
      send(stdin, 'Y');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': true });
    });

    it('should not confirm', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          type: 'confirm',
          name: 'The confirm question name',
          message: 'Is the confirm prompt working?',
        },
      ]);
      send(stdin, 'N');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': false });
    });

    it('should not confirm by default', async () => {
      expect.assertions(4);
      const testConfirmWithDefault = async defaultValue => {
        const stdin = startMock();
        const prompt = inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Is the confirm prompt working?',
            default: defaultValue,
          },
        ]);
        send(stdin, '');
        const result = await prompt;
        stopMock();
        expect(stdout.output).toContain('Is the confirm prompt working?');
        expect(result).toStrictEqual({ confirm: defaultValue });
      };
      await testConfirmWithDefault(true);
      await testConfirmWithDefault(false);
    });
  });

  describe('input', () => {
    it('should work without validation without default', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          name: 'endpoint',
          message: 'Enter your local admin backend endpoint:',
          type: 'input',
        },
      ]);
      send(stdin, 'my-local-admin-backend-endpoint');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'my-local-admin-backend-endpoint' });
    });
    it('should work without validation with default', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          name: 'endpoint',
          message: 'Enter your local admin backend endpoint:',
          type: 'input',
          default: 'my-default-endpoint',
        },
      ]);
      send(stdin, '');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'my-default-endpoint' });
    });
    it('should work with valid validation', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          name: 'endpoint',
          message: 'Enter your local admin backend endpoint:',
          type: 'input',
          validate: value => value === 'same-value',
        },
      ]);
      send(stdin, 'same-value');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'same-value' });
    });
    it('should work with invalid validation', async () => {
      expect.assertions(4);
      const validateReturns = jest.fn();
      const stdin = startMock();
      const prompt = inquirer.prompt([
        {
          name: 'endpoint',
          message: 'Enter your local admin backend endpoint:',
          type: 'input',
          validate: value => {
            validateReturns(value);
            return value === 'same-value';
          },
        },
      ]);
      send(stdin, 'other-value');
      send(stdin, 'same-value');
      const result = await prompt;
      stopMock();
      expect(validateReturns).toHaveBeenNthCalledWith(1, 'other-value');
      expect(validateReturns).toHaveBeenNthCalledWith(2, 'same-value');
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'same-value' });
    });
  });

  describe('list', () => {
    it('should return selected choice with arrow keys', async () => {
      expect.assertions(2);
      const arrowDown = '\u001b[B';
      const enter = '\r';

      const stdin = startMock();

      const prompt = inquirer.prompt([
        {
          type: 'list',
          name: 'dbDialect',
          message: "What's the database type?",
          choices: ['postgres', 'mysql', 'mssql', 'mongodb'],
        },
      ]);

      send(stdin, arrowDown);
      send(stdin, arrowDown);
      send(stdin, arrowDown);
      send(stdin, enter);
      const result = await prompt;
      stopMock();

      expect(stdout.output).toContain("What's the database type?");
      expect(result).toStrictEqual({ dbDialect: 'mysql' });
    });
  });

  describe('password', () => {
    it('should work with a password', async () => {
      expect.assertions(5);
      const validateReturns = jest.fn();
      const stdin = startMock();

      const prompt = inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'What is your Forest Admin password:',
          validate: input => {
            validateReturns(input);
            return input === 'secret' || 'Please enter your password.';
          },
        },
      ]);

      send(stdin, 'badsecret');
      send(stdin, 'secret');
      const result = await prompt;
      stopMock();

      expect(validateReturns).toHaveBeenNthCalledWith(1, 'badsecret');
      expect(validateReturns).toHaveBeenNthCalledWith(2, 'secret');
      expect(stdout.output).toContain('What is your Forest Admin password:');
      expect(stdout.output).toContain('Please enter your password.');
      expect(result).toStrictEqual({ password: 'secret' });
    });
  });
});
