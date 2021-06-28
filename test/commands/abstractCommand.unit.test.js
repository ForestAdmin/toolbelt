const AbstractCommand = require('../../src/abstract-command');

describe('abstract command', () => {
  describe('init', () => {
    it('should check and set dependencies', async () => {
      expect.assertions(3);

      const chalk = Symbol('chalk');
      const logger = Symbol('logger');

      const commandPlan = (plan) => plan
        .addModule('chalk', chalk)
        .addInstance('logger', logger);

      const abstractCommand = new AbstractCommand();
      abstractCommand.init(commandPlan);

      expect(abstractCommand).toBeInstanceOf(AbstractCommand);
      expect(abstractCommand.chalk).toBe(chalk);
      expect(abstractCommand.logger).toBe(logger);
    });

    it('should run with default context plan', async () => {
      expect.assertions(3);

      const abstractCommand = new AbstractCommand();
      abstractCommand.init();

      expect(abstractCommand).toBeInstanceOf(AbstractCommand);
      expect(abstractCommand.chalk).toBeDefined();
      expect(abstractCommand.logger).toBeDefined();
    });
  });
});
