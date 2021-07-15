const AbstractAuthenticatedCommand = require('../../src/abstract-authenticated-command');

describe('abstractAuthenticated command', () => {
  const makePlanAndStubs = () => {
    const stubs = {
      authenticator: {
        getAuthToken: jest.fn(),
        logout: jest.fn().mockResolvedValue(true),
        tryLogin: jest.fn().mockResolvedValue(true),
      },
      chalk: {
        bold: jest.fn((msg) => msg),
      },
      logger: {
        error: jest.fn(),
        info: jest.fn(),
      },
    };
    const commandPlan = (plan) => plan
      .addModule('chalk', stubs.chalk)
      .addInstance('logger', stubs.logger)
      .addInstance('authenticator', stubs.authenticator);
    return {
      commandPlan,
      stubs,
    };
  };

  describe('init', () => {
    it('should check and set dependencies', async () => {
      expect.assertions(2);

      const { commandPlan, stubs } = makePlanAndStubs();
      const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
      abstractAuthenticatedCommand.init(commandPlan);

      expect(abstractAuthenticatedCommand).toBeInstanceOf(AbstractAuthenticatedCommand);
      expect(abstractAuthenticatedCommand.authenticator).toBe(stubs.authenticator);
    });
  });

  describe('run', () => {
    describe('when not autenticated', () => {
      it('should try to login', async () => {
        expect.assertions(2);

        const { commandPlan, stubs } = makePlanAndStubs();
        const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
        abstractAuthenticatedCommand.init(commandPlan);

        stubs.authenticator.getAuthToken.mockImplementation(() => true);
        jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
          .mockImplementation(() => true);

        await abstractAuthenticatedCommand.run();

        expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
        expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
      });

      describe('when login fails', () => {
        it('should exit with code 10', async () => {
          expect.assertions(6);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          stubs.authenticator.getAuthToken.mockImplementation(() => false);
          stubs.authenticator.tryLogin.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'exit')
            .mockImplementation(() => { throw new Error(); });

          await expect(() => abstractAuthenticatedCommand.run()).rejects.toThrow(Error);

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(2);
          expect(stubs.authenticator.tryLogin).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledWith(10);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(0);
        });
      });

      describe('when login succeeds', () => {
        it('should run command', async () => {
          expect.assertions(3);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          stubs.authenticator.getAuthToken
            .mockImplementationOnce(() => false)
            .mockImplementationOnce(() => true);
          stubs.authenticator.tryLogin.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockImplementation(() => true);

          await abstractAuthenticatedCommand.run();

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(2);
          expect(stubs.authenticator.tryLogin).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when authenticated', () => {
      it('should run command directly', async () => {
        expect.assertions(3);

        const { commandPlan, stubs } = makePlanAndStubs();
        const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
        abstractAuthenticatedCommand.init(commandPlan);

        stubs.authenticator.getAuthToken.mockImplementation(() => true);
        stubs.authenticator.tryLogin.mockImplementation(() => true);
        jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
          .mockImplementation(() => true);

        await abstractAuthenticatedCommand.run();

        expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
        expect(stubs.authenticator.tryLogin).toHaveBeenCalledTimes(0);
        expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
      });
    });

    it('command should throw if runIfAuthenticated is not redefined', async () => {
      expect.assertions(2);

      const { commandPlan, stubs } = makePlanAndStubs();
      const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
      abstractAuthenticatedCommand.init(commandPlan);

      stubs.authenticator.getAuthToken.mockImplementation(() => true);

      await expect(() => abstractAuthenticatedCommand.run())
        .rejects.toThrow('\'runIfAuthenticated\' is not implemented on');

      expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
    });

    describe('when command', () => {
      describe('runs properly', () => {
        it('should not throw', async () => {
          expect.assertions(3);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          stubs.authenticator.getAuthToken.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'exit')
            .mockImplementation(() => { throw new Error(); });

          await abstractAuthenticatedCommand.run();

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledTimes(0);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
        });
      });

      describe('fails', () => {
        it('should exit 2 upon 403 error', async () => {
          expect.assertions(6);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          stubs.authenticator.getAuthToken.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockRejectedValue({ status: 403 });
          jest.spyOn(abstractAuthenticatedCommand, 'exit')
            .mockImplementation(() => { throw new Error(); });

          await expect(() => abstractAuthenticatedCommand.run())
            .rejects.toThrow(Error);

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.logger.error)
            .toHaveBeenCalledWith('You do not have the right to execute this action on this project');
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledWith(2);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
        });

        it('should exit 10 upon 401 error', async () => {
          expect.assertions(7);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          stubs.authenticator.getAuthToken.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockRejectedValue({ status: 401 });
          jest.spyOn(abstractAuthenticatedCommand, 'exit')
            .mockImplementation(() => { throw new Error(); });

          await expect(() => abstractAuthenticatedCommand.run())
            .rejects.toThrow(Error);

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
          expect(stubs.authenticator.logout).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.logger.error)
            .toHaveBeenCalledWith('Please use \'forest login\' to sign in to your Forest account.');
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledTimes(1);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledWith(10);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
        });

        it('should rethrow otherwise', async () => {
          expect.assertions(6);

          const { commandPlan, stubs } = makePlanAndStubs();
          const abstractAuthenticatedCommand = new AbstractAuthenticatedCommand();
          abstractAuthenticatedCommand.init(commandPlan);

          const runErrorMessage = 'error in runIfAuthenticated';
          const runError = new Error(runErrorMessage);
          runError.status = -1;

          stubs.authenticator.getAuthToken.mockImplementation(() => true);
          jest.spyOn(abstractAuthenticatedCommand, 'runIfAuthenticated')
            .mockRejectedValue(runError);
          jest.spyOn(abstractAuthenticatedCommand, 'exit')
            .mockImplementation(() => { });

          await expect(() => abstractAuthenticatedCommand.run())
            .rejects.toThrow(runErrorMessage);

          expect(stubs.authenticator.getAuthToken).toHaveBeenCalledTimes(1);
          expect(stubs.authenticator.logout).toHaveBeenCalledTimes(0);
          expect(abstractAuthenticatedCommand.logger.error).toHaveBeenCalledTimes(0);
          expect(abstractAuthenticatedCommand.exit).toHaveBeenCalledTimes(0);
          expect(abstractAuthenticatedCommand.runIfAuthenticated).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
