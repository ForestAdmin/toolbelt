/* eslint-disable max-classes-per-file */
import { Config } from '@oclif/core';

import AbstractAuthenticatedCommand from '../src/abstract-authenticated-command';

describe('abstractAuthenticated command', () => {
  const makePlanAndStubs = () => {
    const stubs = {
      authenticator: {
        getAuthToken: jest.fn().mockReturnValue(false),
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
        runAuthenticated(): Promise<void> {
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

  describe('run', () => {
    class TestAbstractClass extends AbstractAuthenticatedCommand {
      // eslint-disable-next-line class-methods-use-this
      runAuthenticated(): Promise<void> {
        return null as unknown as Promise<void>;
      }
    }

    describe('when the user is not authenticated', () => {
      it('should try to login', async () => {
        expect.assertions(3);

        const { commandPlan, stubs } = makePlanAndStubs();
        const testAbstractClass = new TestAbstractClass(
          [],
          new Config({ root: process.cwd() }),
          commandPlan,
        );

        stubs.authenticator.getAuthToken.mockReturnValueOnce(false).mockReturnValueOnce(true);

        await testAbstractClass.run();

        expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(2);
        expect(stubs.authenticator.tryLogin).toHaveBeenCalledTimes(1);
        expect(stubs.logger.info).toHaveBeenCalledWith('Login required.');
      });
    });

    describe('when the user is authenticated', () => {
      const makePlanAndAuthenticatedStubs = () => {
        const { commandPlan, stubs } = makePlanAndStubs();

        stubs.authenticator.getAuthToken.mockReturnValue(true);

        return {
          commandPlan,
          stubs,
        };
      };

      it('should not try to login', async () => {
        expect.assertions(3);

        const { commandPlan, stubs } = makePlanAndAuthenticatedStubs();
        const testAbstractClass = new TestAbstractClass(
          [],
          new Config({ root: process.cwd() }),
          commandPlan,
        );

        await testAbstractClass.run();

        expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
        expect(stubs.authenticator.tryLogin).not.toHaveBeenCalled();
        expect(stubs.logger.info).not.toHaveBeenCalled();
      });

      describe('when running the authenticated job', () => {
        describe('when receiving a 403 error', () => {
          it('should log it and exit', async () => {
            expect.assertions(3);

            const { commandPlan, stubs } = makePlanAndAuthenticatedStubs();
            const testAbstractClass = new TestAbstractClass(
              [],
              new Config({ root: process.cwd() }),
              commandPlan,
            );

            jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);
            jest.spyOn(testAbstractClass, 'runAuthenticated').mockRejectedValue({
              status: 403,
            });

            await testAbstractClass.run();

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

            const { commandPlan, stubs } = makePlanAndAuthenticatedStubs();
            const testAbstractClass = new TestAbstractClass(
              [],
              new Config({ root: process.cwd() }),
              commandPlan,
            );

            jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);
            jest.spyOn(testAbstractClass, 'runAuthenticated').mockRejectedValue({
              status: 401,
            });

            await testAbstractClass.run();

            expect(stubs.authenticator.logout).toHaveBeenCalledTimes(1);
            expect(stubs.logger.error).toHaveBeenCalledWith(
              `Please use 'forest login' to sign in to your Forest account.`,
            );
            expect(testAbstractClass.exit).toHaveBeenCalledWith(10);
          });
        });

        describe('when receiving any other error', () => {
          it('should propagate the error and not handle it', async () => {
            expect.assertions(2);

            const { commandPlan, stubs } = makePlanAndAuthenticatedStubs();
            const testAbstractClass = new TestAbstractClass(
              [],
              new Config({ root: process.cwd() }),
              commandPlan,
            );

            jest.spyOn(testAbstractClass, 'exit').mockReturnValue(true as never);

            await testAbstractClass.run();

            expect(testAbstractClass.exit).not.toHaveBeenCalled();
            expect(stubs.logger.error).not.toHaveBeenCalled();
          });
        });
      });
    });
  });
});
