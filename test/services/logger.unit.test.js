const Logger = require('../../src/services/logger');

describe('services > Logger', () => {
  // eslint-disable-next-line jest/no-hooks
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
          expect.assertions(6);
          const context = makeContext();
          const { stdout } = context;

          jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
          const logger = new Logger(context);

          logger.log('first message', 'second message', { lineColor: 'green', color: 'red' });

          expect(stdout.write).toHaveBeenCalledTimes(2);
          expect(stdout.write).toHaveBeenCalledWith('first message \n');
          expect(stdout.write).toHaveBeenCalledWith('second message \n');

          expect(Logger._setColor).toHaveBeenCalledTimes(2);
          expect(Logger._setColor).toHaveBeenCalledWith('green', 'first message');
          expect(Logger._setColor).toHaveBeenCalledWith('green', 'second message');
        });
      });
    });
  });

  describe('success', () => {
    it('should display a message to the stdout with a colored prefix', () => {
      expect.assertions(4);
      const context = makeContext();
      const { stdout } = context;

      jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);
      const logger = new Logger(context);
      logger.success('should display this message');

      expect(stdout.write).toHaveBeenCalledTimes(1);
      expect(stdout.write).toHaveBeenCalledWith('√ should display this message \n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
      expect(Logger._setBoldColor).toHaveBeenCalledWith('green', '√ ');
    });

    describe('when the option lineColor is defined', () => {
      it('should display the message in the given lineColor', () => {
        expect.assertions(6);
        const context = makeContext();
        const { stdout } = context;

        jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
        jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

        const logger = new Logger(context);
        logger.success('should display this message', { lineColor: 'green' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('√ should display this message \n');

        expect(Logger._setColor).toHaveBeenCalledTimes(1);
        expect(Logger._setColor).toHaveBeenCalledWith('green', 'should display this message');

        expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
        expect(Logger._setBoldColor).toHaveBeenCalledWith('green', '√ ');
      });
    });

    describe('when the options lineColor is defined and also the color', () => {
      it('should display the message in the given lineColor and the prefix with the given color', () => {
        expect.assertions(6);
        const context = makeContext();
        const { stdout } = context;

        jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
        jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

        const logger = new Logger(context);
        logger.success('should display this message', { lineColor: 'green', color: 'red' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('√ should display this message \n');

        expect(Logger._setColor).toHaveBeenCalledTimes(1);
        expect(Logger._setColor).toHaveBeenCalledWith('green', 'should display this message');

        expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
        expect(Logger._setBoldColor).toHaveBeenCalledWith('red', '√ ');
      });
    });
  });
});
