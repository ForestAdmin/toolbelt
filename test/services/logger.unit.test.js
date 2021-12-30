const Logger = require('../../src/services/logger');

describe('services > Logger', () => {
  // eslint-disable-next-line jest/no-hooks
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const makeContext = () =>
    ({
      env: jest.fn(),
      stderr: {
        write: jest.fn(),
      },
      stdout: {
        write: jest.fn(),
      },
      assertPresent: jest.fn(),
    });

  describe('log', () => {
    it('should display a message to the stdout without a prefix', () => {
      expect.assertions(4);
      const context = makeContext();
      const { stdout } = context;

      jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
      jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

      const logger = new Logger(context);
      logger.log('should display this message');

      expect(stdout.write).toHaveBeenCalledTimes(1);
      expect(stdout.write).toHaveBeenCalledWith('should display this message\n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(0);
      expect(Logger._setColor).toHaveBeenCalledTimes(0);
    });

    describe('when silent is activated', () => {
      it('should not display the message', () => {
        expect.assertions(2);
        const context = makeContext();
        const { stdout, stderr } = context;

        const logger = new Logger(context);
        logger.silent = true;
        logger.log('should display this message');

        expect(stdout.write).toHaveBeenCalledTimes(0);
        expect(stderr.write).toHaveBeenCalledTimes(0);
      });
    });

    describe('when a message is an object', () => {
      it('should display the object as json', () => {
        expect.assertions(2);
        const context = makeContext();
        const { stdout } = context;

        const logger = new Logger(context);
        const objectToDisplay = { id: 1 };
        logger.log(objectToDisplay);

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith(`${JSON.stringify(objectToDisplay)}\n`);
      });
    });

    describe('when there are several messages', () => {
      it('should display all the messages', () => {
        expect.assertions(3);
        const context = makeContext();
        const { stdout } = context;

        const logger = new Logger(context);
        logger.log('first message', 'second message');

        expect(stdout.write).toHaveBeenCalledTimes(2);
        expect(stdout.write).toHaveBeenCalledWith('first message\n');
        expect(stdout.write).toHaveBeenCalledWith('second message\n');
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
          expect(stdout.write).toHaveBeenCalledWith('first message\n');
          expect(stdout.write).toHaveBeenCalledWith('second message\n');

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
      expect(stdout.write).toHaveBeenCalledWith('√ should display this message\n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
      expect(Logger._setBoldColor).toHaveBeenCalledWith('green', '√ ');
    });

    describe('when the option lineColor is defined', () => {
      it('should display the message in the given color', () => {
        expect.assertions(6);
        const context = makeContext();
        const { stdout } = context;

        jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
        jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

        const logger = new Logger(context);
        logger.success('should display this message', { lineColor: 'green' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('√ should display this message\n');

        expect(Logger._setColor).toHaveBeenCalledTimes(1);
        expect(Logger._setColor).toHaveBeenCalledWith('green', 'should display this message');

        expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
        expect(Logger._setBoldColor).toHaveBeenCalledWith('green', '√ ');
      });
    });

    describe('when the options lineColor is defined and also the color', () => {
      it('should display the message in the given colors for the prefix and the message', () => {
        expect.assertions(6);
        const context = makeContext();
        const { stdout } = context;

        jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
        jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

        const logger = new Logger(context);
        logger.success('should display this message', { lineColor: 'green', color: 'red' });

        expect(stdout.write).toHaveBeenCalledTimes(1);
        expect(stdout.write).toHaveBeenCalledWith('√ should display this message\n');

        expect(Logger._setColor).toHaveBeenCalledTimes(1);
        expect(Logger._setColor).toHaveBeenCalledWith('green', 'should display this message');

        expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
        expect(Logger._setBoldColor).toHaveBeenCalledWith('red', '√ ');
      });
    });
  });

  describe('warn', () => {
    it('should display a message to the stdout with a colored prefix', () => {
      expect.assertions(5);
      const context = makeContext();
      const { stdout } = context;

      jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
      jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

      const logger = new Logger(context);
      logger.warn('should display this message');

      expect(stdout.write).toHaveBeenCalledTimes(1);
      expect(stdout.write).toHaveBeenCalledWith('Δ should display this message\n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
      expect(Logger._setBoldColor).toHaveBeenCalledWith('yellow', 'Δ ');

      expect(Logger._setColor).toHaveBeenCalledTimes(0);
    });
  });

  describe('info', () => {
    it('should display a message to the stdout with a colored prefix', () => {
      expect.assertions(5);
      const context = makeContext();
      const { stdout } = context;

      jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
      jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

      const logger = new Logger(context);
      logger.info('should display this message');

      expect(stdout.write).toHaveBeenCalledTimes(1);
      expect(stdout.write).toHaveBeenCalledWith('> should display this message\n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
      expect(Logger._setBoldColor).toHaveBeenCalledWith('blue', '> ');

      expect(Logger._setColor).toHaveBeenCalledTimes(0);
    });
  });

  describe('error', () => {
    it('should display a message to the stderr with a colored prefix', () => {
      expect.assertions(5);
      const context = makeContext();
      const { stderr } = context;

      jest.spyOn(Logger, '_setColor').mockImplementation((color, message) => message);
      jest.spyOn(Logger, '_setBoldColor').mockImplementation((color, message) => message);

      const logger = new Logger(context);
      logger.error('should display this message');

      expect(stderr.write).toHaveBeenCalledTimes(1);
      expect(stderr.write).toHaveBeenCalledWith('× should display this message\n');

      expect(Logger._setBoldColor).toHaveBeenCalledTimes(1);
      expect(Logger._setBoldColor).toHaveBeenCalledWith('red', '× ');

      expect(Logger._setColor).toHaveBeenCalledTimes(0);
    });
  });

  describe('_setColor', () => {
    it('should return the message', () => {
      expect.assertions(1);

      const result = Logger._setColor('red', 'a message');

      expect(result).toContain('a message');
    });
  });

  describe('_setBoldColor', () => {
    it('should return the message', () => {
      expect.assertions(1);

      const result = Logger._setBoldColor('red', 'a message');

      expect(result).toContain('a message');
    });
  });
});
