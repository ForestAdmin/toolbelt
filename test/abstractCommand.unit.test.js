const { Config } = require('@oclif/config');

const AbstractCommand = require('../src/abstract-command').default;

describe('abstract command', () => {
  describe('constructor', () => {
    it('should check and set dependencies', async () => {
      expect.assertions(3);

      const chalk = Symbol('chalk');
      const logger = Symbol('logger');

      const commandPlan = plan => plan.addModule('chalk', chalk).addInstance('logger', logger);

      const abstractCommand = new AbstractCommand(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );
      expect(abstractCommand).toBeInstanceOf(AbstractCommand);
      expect(abstractCommand.chalk).toBe(chalk);
      expect(abstractCommand.logger).toBe(logger);
    });

    it('should run with default context plan', async () => {
      expect.assertions(3);

      const abstractCommand = new AbstractCommand([], new Config({ root: process.cwd() }));

      expect(abstractCommand).toBeInstanceOf(AbstractCommand);
      expect(abstractCommand.chalk).toBeDefined();
      expect(abstractCommand.logger).toBeDefined();
    });
  });
});
