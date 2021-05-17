const Authenticator = require('../../services/authenticator');

describe('services > Authenticator', () => {
  function setup() {
    const oidcAuthenticator = {
      authenticate: jest.fn(),
    };
    const applicationTokenService = {
      generateApplicationToken: jest.fn(),
      deleteApplicationToken: jest.fn(),
    };
    const os = {
      homedir: jest.fn().mockReturnValue('sweet-home'),
    };

    const fs = {
      unlinkSync: jest.fn(),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
    };
    const chalk = {
      red: jest.fn().mockImplementation((value) => `[red]${value}[/red]`),
      green: jest.fn().mockImplementation((value) => `[green]${value}[/green]`),
    };

    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const jwtDecode = jest.fn();

    const api = {};
    const terminator = {};
    const authenticatorHelper = {};
    const inquirer = {};
    const fsAsync = {
      stat: jest.fn(),
      readFile: jest.fn(),
      unlink: jest.fn(),
    };

    const context = {
      oidcAuthenticator,
      applicationTokenService,
      os,
      fs,
      chalk,
      logger,
      jwtDecode,
      api,
      terminator,
      authenticatorHelper,
      inquirer,
      fsAsync,
      applicationTokenService,
      FOREST_PATH: 'sweet-home/.forestrc',
    };

    const authenticator = new Authenticator(context);

    return {
      authenticator,
      ...context,
    };
  }

  describe('logout', () => {
    describe('when the user is logged in', () => {
      it('should delete the lumberrc file and delete the application token', async () => {
        expect.assertions(4);
        const {
          fsAsync, authenticator, applicationTokenService, LUMBER_PATH,
        } = setup();

        fsAsync.stat.mockReturnValue(undefined);
        fsAsync.readFile.mockResolvedValue('TOKEN');
        applicationTokenService.deleteApplicationToken.mockResolvedValue(undefined);
        fsAsync.unlink.mockResolvedValue(undefined);

        await authenticator.logout();

        expect(fsAsync.stat).toHaveBeenCalledWith(LUMBER_PATH);
        expect(fsAsync.readFile).toHaveBeenCalledWith(LUMBER_PATH, { encoding: 'utf8' });
        expect(applicationTokenService.deleteApplicationToken).toHaveBeenCalledWith('TOKEN');
        expect(fsAsync.unlink).toHaveBeenCalledWith(LUMBER_PATH);
      });
    });

    describe('when the lumberrc file exists but is empty', () => {
      it('should delete the file without calling the API', async () => {
        expect.assertions(2);
        const {
          fsAsync, authenticator, applicationTokenService, LUMBER_PATH,
        } = setup();

        fsAsync.stat.mockReturnValue(undefined);
        fsAsync.readFile.mockResolvedValue('');
        fsAsync.unlink.mockResolvedValue(undefined);

        await authenticator.logout();

        expect(applicationTokenService.deleteApplicationToken).not.toHaveBeenCalled();
        expect(fsAsync.unlink).toHaveBeenCalledWith(LUMBER_PATH);
      });
    });

    describe('when the lumberrc file does not exist', () => {
      it('should write a message indicating that the user is not logged in', async () => {
        expect.assertions(3);
        const {
          fsAsync, authenticator, logger, LUMBER_PATH,
        } = setup();

        fsAsync.stat.mockRejectedValue({ code: 'ENOENT' });

        await authenticator.logout();

        expect(fsAsync.stat).toHaveBeenCalledWith(LUMBER_PATH);
        expect(logger.info).toHaveBeenCalledWith('You were not logged in');
        expect(fsAsync.readFile).not.toHaveBeenCalled();
      });
    });

    describe('when the api returned an error', () => {
      it('should delete the file as well', async () => {
        expect.assertions(2);
        const {
          fsAsync, authenticator, applicationTokenService, LUMBER_PATH,
        } = setup();

        fsAsync.stat.mockReturnValue(undefined);
        fsAsync.readFile.mockResolvedValue('TOKEN');
        const error = new Error('the error');
        applicationTokenService.deleteApplicationToken.mockRejectedValue(error);
        fsAsync.unlink.mockResolvedValue(undefined);

        await expect(authenticator.logout()).rejects.toBe(error);

        expect(fsAsync.unlink).toHaveBeenCalledWith(LUMBER_PATH);
      });
    });

    describe('when reading the file throws an error', () => {
      it('should propagate the error', async () => {
        expect.assertions(2);

        const { fsAsync, authenticator } = setup();

        const error = new Error('the error');
        fsAsync.stat.mockRejectedValue(error);

        await expect(authenticator.logout()).rejects.toBe(error);

        expect(fsAsync.unlink).not.toHaveBeenCalled();
      });
    });
  });


  describe('tryLogin', () => {
    describe('when the password and token are not provided', () => {
      it('should authenticate with oidc, generate an application token and return it', async () => {
        expect.assertions(4);

        const {
          authenticator,
          oidcAuthenticator,
          applicationTokenService,
          fs,
          logger,
          FOREST_PATH,
        } = setup();

        oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
        applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');

        await authenticator.tryLogin({});

        expect(logger.error).not.toHaveBeenCalled();
        expect(oidcAuthenticator.authenticate).toHaveBeenCalledWith();
        expect(applicationTokenService.generateApplicationToken).toHaveBeenCalledWith('SESSION-TOKEN');
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          FOREST_PATH,
          'APP-TOKEN',
        );
      });
    });

    describe('when the user is already logged in', () => {
      describe('when the token is saved in forestrc', () => {
        it('should delete the forestrc file', async () => {
          expect.assertions(5);

          const {
            authenticator,
            oidcAuthenticator,
            applicationTokenService,
            fs,
            logger,
            jwtDecode,
            FOREST_PATH,
            LUMBER_PATH,
          } = setup();

          oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
          applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');
          fs.readFileSync.mockImplementation((path) => {
            if (path === FOREST_PATH) return 'PREVIOUS-TOKEN';
            return '';
          });
          jwtDecode.mockReturnValue({ exp: (Date.now().valueOf() / 1000) + 5000 });

          await authenticator.tryLogin({});

          expect(logger.error).not.toHaveBeenCalled();
          expect(fs.readFileSync).toHaveBeenCalledWith(FOREST_PATH, 'utf8');
          expect(fs.readFileSync).toHaveBeenCalledWith(LUMBER_PATH, 'utf8');
          expect(jwtDecode).toHaveBeenCalledWith('PREVIOUS-TOKEN');
          expect(fs.unlinkSync).toHaveBeenCalledWith(FOREST_PATH);
        });
      });

      describe('when the token is saved in lumberrc', () => {
        it('should not delete the lumberrc file', async () => {
          expect.assertions(2);

          const {
            authenticator,
            oidcAuthenticator,
            applicationTokenService,
            fs,
            logger,
            jwtDecode,
            LUMBER_PATH,
          } = setup();

          oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
          applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');
          fs.readFileSync.mockImplementation((path) => {
            if (path === LUMBER_PATH) return 'PREVIOUS-TOKEN';
            return '';
          });
          jwtDecode.mockReturnValue({ exp: (Date.now().valueOf() / 1000) + 5000 });

          await authenticator.tryLogin({});

          expect(logger.error).not.toHaveBeenCalled();
          expect(fs.unlinkSync).not.toHaveBeenCalledWith(LUMBER_PATH);
        });
      });
    });
  });

  describe('logout', () => {
    function mockGetToken(pathWithAToken) {
      return (path) => {
        if (path === pathWithAToken) {
          return 'THE TOKEN';
        }
        throw new Error('Not found');
      };
    }

    describe('when called without options', () => {
      it('should delete the .forestrc file and call the api to invalidate the token', async () => {
        expect.assertions(5);
        const {
          authenticator, fs, jwtDecode, applicationTokenService,
          FOREST_PATH, logger,
        } = setup();

        fs.readFileSync
          .mockImplementation(mockGetToken(FOREST_PATH));
        jwtDecode.mockReturnValue({ exp: (Date.now() / 1000) + 60 });
        applicationTokenService.deleteApplicationToken
          .mockResolvedValue(undefined);

        await authenticator.logout();

        expect(fs.readFileSync).toHaveBeenCalledWith(FOREST_PATH, 'utf8');
        expect(fs.unlinkSync).toHaveBeenCalledWith(FOREST_PATH);
        expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
        expect(applicationTokenService.deleteApplicationToken).toHaveBeenCalledWith('THE TOKEN');
        expect(logger.info).not.toHaveBeenCalled();
      });

      it('should do nothing if the token is in the lumberrc file', async () => {
        expect.assertions(4);
        const {
          authenticator, fs, jwtDecode, applicationTokenService,
          LUMBER_PATH, logger,
        } = setup();

        fs.readFileSync
          .mockImplementation(mockGetToken(LUMBER_PATH));
        jwtDecode.mockReturnValue({ exp: (Date.now() / 1000) + 60 });

        await authenticator.logout();

        expect(fs.readFileSync).toHaveBeenCalledWith(LUMBER_PATH, 'utf8');
        expect(fs.unlinkSync).not.toHaveBeenCalled();
        expect(applicationTokenService.deleteApplicationToken).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
      });
    });

    describe('when called with the option to write log messages', () => {
      it('should logout and write a message', async () => {
        expect.assertions(3);
        const {
          authenticator, fs, jwtDecode, applicationTokenService,
          FOREST_PATH, logger,
        } = setup();

        fs.readFileSync
          .mockImplementation(mockGetToken(FOREST_PATH));
        jwtDecode.mockReturnValue({ exp: (Date.now() / 1000) + 60 });
        applicationTokenService.deleteApplicationToken
          .mockResolvedValue(undefined);

        await authenticator.logout({ log: true });

        expect(fs.unlinkSync).toHaveBeenCalledWith(FOREST_PATH);
        expect(applicationTokenService.deleteApplicationToken).toHaveBeenCalledWith('THE TOKEN');
        expect(logger.info).toHaveBeenCalledWith('[green]You are logged out.[/green]');
      });

      it('should not do anything and write a message', async () => {
        expect.assertions(3);
        const {
          authenticator, fs, jwtDecode, applicationTokenService,
          LUMBER_PATH, logger,
        } = setup();

        fs.readFileSync
          .mockImplementation(mockGetToken(LUMBER_PATH));
        jwtDecode.mockReturnValue({ exp: (Date.now() / 1000) + 60 });
        applicationTokenService.deleteApplicationToken
          .mockResolvedValue(undefined);

        await authenticator.logout({ log: true });

        expect(fs.unlinkSync).not.toHaveBeenCalled();
        expect(applicationTokenService.deleteApplicationToken).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('You cannot be logged out with this command. Please use "lumber logout" command.');
      });
    });
  });

});
