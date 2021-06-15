const inquirer = require('inquirer');
const mockStdin = require('mock-stdin');
const { stdout } = require('stdout-stderr');

describe('inquirer', () => {
  describe('confirm', () => {
    it('should confirm', async () => {
      expect.assertions(2);
      const stdin = mockStdin.stdin();
      stdout.start();
      setTimeout(() => stdin.send('Y\n'), 100);
      const result = await inquirer.prompt([{
        type: 'confirm',
        name: 'The confirm question name',
        message: 'Is the confirm prompt working?',
      }]);
      stdout.stop();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': true });
    });
    it('should not confirm', async () => {
      expect.assertions(2);
      const stdin = mockStdin.stdin();
      stdout.start();
      setTimeout(() => stdin.send('N\n'), 100);
      const result = await inquirer.prompt([{
        type: 'confirm',
        name: 'The confirm question name',
        message: 'Is the confirm prompt working?',
      }]);
      stdout.stop();
      expect(stdout.output).toContain('Is the confirm prompt working?');
      expect(result).toStrictEqual({ 'The confirm question name': false });
    });
  });
});
