/* eslint-disable max-classes-per-file */
import { Config } from '@oclif/config';
import AbstractAuthenticatedCommand from '../src/abstract-authenticated-command';

describe('abstractAuthenticated command', () => {
  const makePlanAndStubs = () => {
    const stubs = {
      authenticator: {
        getAuthToken: jest.fn(),
        logout: jest.fn().mockResolvedValue(true),
        tryLogin: jest.fn().mockResolvedValue(true),
      },
      chalk: {
        bold: jest.fn(msg => msg),
      },
      logger: {
        error: jest.fn(),
        info: jest.fn(),
      },
    };
    const commandPlan = plan =>
      plan
        .addModule('chalk', stubs.chalk)
        .addInstance('logger', stubs.logger)
        .addInstance('authenticator', stubs.authenticator);
    return {
      commandPlan,
      stubs,
    };
  };

  describe('constructor', () => {
    it('should check and set dependencies', async () => {
      expect.assertions(2);

      const { commandPlan, stubs } = makePlanAndStubs();

      class TestAbstractClass extends AbstractAuthenticatedCommand {
        constructor(argv: string[], config: Config, plan) {
          super(argv, config, plan);

          // protected properties are not accessible outside the class
          expect(this.authenticator).toBe(stubs.authenticator);
        }

        // eslint-disable-next-line class-methods-use-this
        run(): Promise<void> {
          throw new Error('Method not implemented.');
        }
      }

      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );

      expect(testAbstractClass).toBeInstanceOf(AbstractAuthenticatedCommand);
    });
  });

  describe('checkAuthentication', () => {
    class TestAbstractClass extends AbstractAuthenticatedCommand {
      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    it('should try to login if not authenticated', async () => {
      expect.assertions(3);

      const { commandPlan, stubs } = makePlanAndStubs();
      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );

      stubs.authenticator.getAuthToken.mockReturnValueOnce(false).mockReturnValueOnce(true);

      await testAbstractClass.checkAuthentication();

      expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(2);
      expect(stubs.authenticator.tryLogin).toHaveBeenCalledTimes(1);
      expect(stubs.logger.info).toHaveBeenCalledWith('Login required.');
    });

    it('should not try to login if already authenticated', async () => {
      expect.assertions(3);

      const { commandPlan, stubs } = makePlanAndStubs();
      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );

      stubs.authenticator.getAuthToken.mockReturnValue(true);

      await testAbstractClass.checkAuthentication();

      expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
      expect(stubs.authenticator.tryLogin).not.toHaveBeenCalled();
      expect(stubs.logger.info).not.toHaveBeenCalled();
    });

    it('should exit if login fails', async () => {
      expect.assertions(2);

      const { commandPlan, stubs } = makePlanAndStubs();
      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );

      stubs.authenticator.getAuthToken.mockReturnValue(false);

      jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);

      await testAbstractClass.checkAuthentication();

      expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(2);
      expect(testAbstractClass.exit).toHaveBeenCalledWith(10);
    });
  });

  describe('handleAuthenticationErrors', () => {
    class TestAbstractClass extends AbstractAuthenticatedCommand {
      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    describe('when receiving a 403 error', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const { commandPlan, stubs } = makePlanAndStubs();
        const testAbstractClass = new TestAbstractClass(
          [],
          new Config({ root: process.cwd() }),
          commandPlan,
        );

        const error = {
          status: 403,
        };

        jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);

        await testAbstractClass.handleAuthenticationErrors(error);

        expect(stubs.authenticator.logout).not.toHaveBeenCalled();
        expect(stubs.logger.error).toHaveBeenCalledWith(
          'You do not have the right to execute this action on this project',
        );
        expect(testAbstractClass.exit).toHaveBeenCalledWith(2);
      });
    });

    describe('when receiving a 401 error', () => {
      it('should logout the user, log it and exit', async () => {
        expect.assertions(3);

        const { commandPlan, stubs } = makePlanAndStubs();
        const testAbstractClass = new TestAbstractClass(
          [],
          new Config({ root: process.cwd() }),
          commandPlan,
        );

        const error = {
          status: 401,
        };

        jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);

        await testAbstractClass.handleAuthenticationErrors(error);

        expect(stubs.authenticator.logout).toHaveBeenCalledTimes(1);
        expect(stubs.logger.error).toHaveBeenCalledWith(
          "Please use 'forest login' to sign in to your Forest account.",
        );
        expect(testAbstractClass.exit).toHaveBeenCalledWith(10);
      });
    });
  });
});
