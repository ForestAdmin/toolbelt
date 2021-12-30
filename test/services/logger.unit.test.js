const Logger = require('../../src/services/logger');

describe('services > Logger', () => {
  const makeContext = () =>
    ({
      env: jest.fn(),
      stderr: jest.fn(),
      stdout: {
        write: jest.fn(),
      },
      assertPresent: jest.fn(),
    });

  describe('log', () => {
    describe('when there are several messages', () => {
      it('should display all the messages', () => {
        expect.assertions(3);
        const context = makeContext();
        const { stdout } = context;

        const logger = new Logger(context);
        logger.log('first message', 'second message');

        expect(stdout.write).toHaveBeenCalledTimes(2);
        expect(stdout.write).toHaveBeenCalledWith('first message \n');
        expect(stdout.write).toHaveBeenCalledWith('second message \n');
      });

      describe('when the options are given', () => {
        it('should display all the messages with the given options', () => {
          expect.assertions(3);
          const context = makeContext();
          const { stdout } = context;

          const logger = new Logger(context);
          logger.log('first message', 'second message', { colorLine: 'green', color: 'red' });

          expect(stdout.write).toHaveBeenCalledTimes(2);
          expect(stdout.write).toHaveBeenCalledWith('[32mfirst message[39m \n');
          expect(stdout.write).toHaveBeenCalledWith('[32msecond message[39m \n');
        });
      });
    });
  });

  describe('success', () => {
    it('should display a message to the stdout with a colored prefix', () => {
      expect.assertions(2);
      const context = makeContext();
      const { stdout } = context;

      const logger = new Logger(context);
      logger.success('should display this message');

      expect(stdout.write).toHaveBeenCalledTimes(1);
      expect(stdout.write).toHaveBeenCalledWith('[1m[32m√ [39m[22mshould display this message \n');
    });

    describe('when the option colorLine is defined', () => {
      it('should display the message in the given colorLine', () => {
        expect.assertions(2);
        const context = makeContext();
        const { stdout } = context;

        const logger = new Logger(context);
        logger.success('should display this message', { colorLine: 'green' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('[1m[32m√ [39m[22m[32mshould display this message[39m \n');
      });
    });

    describe('when the options colorLine is defined and also the color', () => {
      it('should display the message in the given colorLine and the prefix with the given color', () => {
        expect.assertions(2);
        const context = makeContext();
        const { stdout } = context;

        const logger = new Logger(context);
        logger.success('should display this message', { colorLine: 'green', color: 'red' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('[1m[31m√ [39m[22m[32mshould display this message[39m \n');
      });
    });
  });
});
