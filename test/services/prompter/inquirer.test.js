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
      const prompt = inquirer.prompt([{
        type: 'confirm',
        name: 'The confirm question name',
        message: 'Is the confirm prompt working?',
      }]);
      send(stdin, 'Y');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': true });
    });

    it('should not confirm', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([{
        type: 'confirm',
        name: 'The confirm question name',
        message: 'Is the confirm prompt working?',
      }]);
      send(stdin, 'N');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': false });
    });

    it('should not confirm by default', async () => {
      expect.assertions(4);
      const testConfirmWithDefault = async (defaultValue) => {
        const stdin = startMock();
        const prompt = inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Is the confirm prompt working?',
          default: defaultValue,
        }]);
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
      const prompt = inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
      }]);
      send(stdin, 'my-local-admin-backend-endpoint');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'my-local-admin-backend-endpoint' });
    });
    it('should work without validation with default', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        default: 'my-default-endpoint',
      }]);
      send(stdin, '');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'my-default-endpoint' });
    });
    it('should work with valid validation', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        validate: (value) => value === 'same-value',
      }]);
      send(stdin, 'same-value');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'same-value' });
    });
    it('should work with invalid validation', async () => {
      expect.assertions(2);
      const stdin = startMock();
      const prompt = inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        validate: (value) => value === 'same-value',
      }]);
      send(stdin, 'other-value');
      send(stdin, 'same-value');
      const result = await prompt;
      stopMock();
      expect(stdout.output).toContain('Enter your local admin backend endpoint:');
      expect(result).toStrictEqual({ endpoint: 'same-value' });
    });
  });
});
