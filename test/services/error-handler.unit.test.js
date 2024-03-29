const ForestCLIError = require('../../src/errors/forest-cli-error');
const ErrorHandler = require('../../src/utils/error-handler');

describe('service > Oidc > ErrorHandler', () => {
  function setupTest() {
    const context = {
      assertPresent: () => true,
      terminator: {
        terminate: jest.fn(),
      },
      chalk: {
        red: jest.fn().mockImplementation(value => `<red>${value}</red>`),
      },
      messages: {
        ERROR_UNEXPECTED: 'Unexpected',
      },
    };
    const errorHandler = new ErrorHandler(context);

    return {
      ...context,
      errorHandler,
    };
  }
  describe('handle', () => {
    describe('when the error is unknown', () => {
      it('should display a message indicating that the error is unknown', () => {
        expect.assertions(1);

        const { errorHandler, terminator } = setupTest();

        errorHandler.handle(new Error('The error'));

        expect(terminator.terminate).toHaveBeenCalledWith(1, {
          logs: ['Unexpected <red>The error</red>'],
        });
      });
    });

    describe('when the error is known', () => {
      it('should output the reason if provided', () => {
        expect.assertions(1);

        const { errorHandler, terminator } = setupTest();

        errorHandler.handle(
          new ForestCLIError('The error', undefined, { reason: 'The inner error' }),
        );

        expect(terminator.terminate).toHaveBeenCalledWith(1, {
          logs: ['<red>The error</red>: The inner error'],
        });
      });

      it('should output the possible solution if provided', () => {
        expect.assertions(1);

        const { errorHandler, terminator } = setupTest();

        errorHandler.handle(
          new ForestCLIError('The error', undefined, { possibleSolution: 'possible solution' }),
        );

        expect(terminator.terminate).toHaveBeenCalledWith(1, {
          logs: ['<red>The error</red>', 'possible solution'],
        });
      });
    });
  });
});
