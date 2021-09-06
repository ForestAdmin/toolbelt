const Authenticator = require('../../src/services/authenticator');

describe('services > authenticator', () => {
  function setup() {
    const oidcAuthenticator = {
      authenticate: jest.fn(),
    };
    const applicationTokenService = {
      generateApplicationToken: jest.fn(),
      deleteApplicationToken: jest.fn(),
    };
    const env = {
      TOKEN_PATH: 'sweet-home',
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

    const mkdirp = jest.fn();

    const context = {
      env,
      oidcAuthenticator,
      applicationTokenService,
      fs,
      chalk,
      logger,
      jwtDecode,
      mkdirp,
      FOREST_PATH: 'sweet-home/.forestrc',
      FOREST_D_PATH: 'sweet-home/.forest.d/.forestrc',
      LUMBER_PATH: 'sweet-home/.lumberrc',
    };

    const authenticator = new Authenticator(context);

    return { ...context, authenticator };
  }

  describe('getAuthToken', () => {
    describe('when .forest.d/.forestrc found', () => {
      it('should return .forest.d/.forestrc token', () => {
        expect.assertions(2);
        const { authenticator } = setup();
        const token = Symbol('token');
        jest
          .spyOn(authenticator, 'getVerifiedToken')
          .mockReturnValue(token);

        const result = authenticator.getAuthToken();

        expect(authenticator.getVerifiedToken)
          .toHaveBeenCalledWith('sweet-home/.forest.d/.forestrc');
        expect(result).toBe(token);
      });
    });
    describe('when .forestrc found', () => {
      it('should return .forestrc token', () => {
        expect.assertions(2);
        const { authenticator } = setup();
        const token = Symbol('token');
        jest
          .spyOn(authenticator, 'getVerifiedToken')
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(token);

        const result = authenticator.getAuthToken();

        expect(authenticator.getVerifiedToken).toHaveBeenNthCalledWith(2, 'sweet-home/.forestrc');
        expect(result).toBe(token);
      });
    });
    describe('when .forestrc is not found', () => {
      describe('when .lumberrc is found', () => {
        it('should return .lumberrc token', () => {
          expect.assertions(2);
          const { authenticator } = setup();
          const lumberToken = Symbol('lumberToken');
          jest
            .spyOn(authenticator, 'getVerifiedToken')
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(lumberToken);

          const result = authenticator.getAuthToken();

          expect(authenticator.getVerifiedToken)
            .toHaveBeenNthCalledWith(3, 'sweet-home/.lumberrc');
          expect(result).toBe(lumberToken);
        });
      });
      describe('when .lumberrc is not found', () => {
        it('should return null', () => {
          expect.assertions(2);
          const { authenticator } = setup();
          jest
            .spyOn(authenticator, 'getVerifiedToken')
            .mockReturnValue(null);

          const result = authenticator.getAuthToken();

          expect(authenticator.getVerifiedToken)
            .toHaveBeenNthCalledWith(3, 'sweet-home/.lumberrc');
          expect(result).toBeNull();
        });
      });
    });
  });

  describe('getVerifiedToken', () => {
    describe('when token is not found', () => {
      it('should return null', () => {
        expect.assertions(2);
        const { authenticator } = setup();
        jest
          .spyOn(authenticator, 'readAuthTokenFrom')
          .mockReturnValue(null);

        const path = Symbol('path');
        const result = authenticator.getVerifiedToken(path);

        expect(authenticator.readAuthTokenFrom).toHaveBeenCalledWith(path);
        expect(result).toBeNull();
      });
    });
    describe('when token is found', () => {
      it('should return the token', () => {
        expect.assertions(3);
        const { authenticator } = setup();
        const token = Symbol('token');
        jest
          .spyOn(authenticator, 'readAuthTokenFrom')
          .mockReturnValue(token);
        jest
          .spyOn(authenticator, 'verify')
          .mockReturnValue(token);

        const path = Symbol('path');
        const result = authenticator.getVerifiedToken(path);

        expect(authenticator.readAuthTokenFrom).toHaveBeenCalledWith(path);
        expect(authenticator.verify).toHaveBeenCalledWith(token);
        expect(result).toBe(token);
      });
    });
  });

  describe('readAuthTokenFrom', () => {
    describe('when read fails', () => {
      it('should return the file', () => {
        expect.assertions(2);
        const { authenticator, fs } = setup();

        fs.readFileSync.mockImplementation(() => { throw new Error(); });
        const path = Symbol('path');
        const result = authenticator.readAuthTokenFrom(path);

        expect(fs.readFileSync).toHaveBeenCalledWith(path, 'utf8');
        expect(result).toBeNull();
      });
    });
    describe('when read works', () => {
      it('should return the token', () => {
        expect.assertions(2);
        const { authenticator, fs } = setup();

        const token = Symbol('token');
        fs.readFileSync.mockReturnValue(token);
        const path = Symbol('path');
        const result = authenticator.readAuthTokenFrom(path);

        expect(fs.readFileSync).toHaveBeenCalledWith(path, 'utf8');
        expect(result).toBe(token);
      });
    });
  });

  describe('verify', () => {
    describe('when token is null', () => {
      it('should not validate', () => {
        expect.assertions(1);
        const { authenticator } = setup();
        expect(authenticator.verify(null)).toBeNull();
      });
    });
    describe('when jwtDecode throws', () => {
      it('should not validate', () => {
        expect.assertions(2);
        const { authenticator, jwtDecode } = setup();

        jwtDecode.mockImplementation(() => { throw new Error(); });

        const token = Symbol('token');
        const result = authenticator.verify(token);

        expect(jwtDecode).toHaveBeenCalledWith(token);
        expect(result).toBeNull();
      });
    });
    describe('when jwtDecode decodes a invalid token', () => {
      it('should not validate', () => {
        expect.assertions(2);
        const { authenticator, jwtDecode } = setup();

        const decodedToken = { exp: (Date.now().valueOf() / 1000) - 100000 }; // far in the past
        jwtDecode.mockReturnValue(decodedToken);

        const token = Symbol('token');
        const result = authenticator.verify(token);

        expect(jwtDecode).toHaveBeenCalledWith(token);
        expect(result).toBeNull();
      });
    });
    describe('when jwtDecode decodes a valid token', () => {
      it('should validate', () => {
        expect.assertions(2);
        const { authenticator, jwtDecode } = setup();

        const decodedToken = { exp: (Date.now().valueOf() / 1000) + 100000 }; // far in the future
        jwtDecode.mockReturnValue(decodedToken);

        const token = Symbol('token');
        const result = authenticator.verify(token);

        expect(jwtDecode).toHaveBeenCalledWith(token);
        expect(result).toStrictEqual(token);
      });
    });
  });

  describe('saveToken', () => {
    it('creates path and token file', async () => {
      expect.assertions(2);
      const { authenticator, mkdirp, fs } = setup();
      const token = Symbol('token');

      await authenticator.saveToken(token);

      expect(mkdirp).toHaveBeenCalledWith('sweet-home/.forest.d');
      expect(fs.writeFileSync).toHaveBeenCalledWith('sweet-home/.forest.d/.forestrc', token);
    });
  });

  describe('tryLogin', () => {
    describe('when it succeeds to login', () => {
      it('saves the token', async () => {
        expect.assertions(1);
        const { authenticator } = setup();

        jest.spyOn(authenticator, 'logout');
        const token = Symbol('token');
        jest.spyOn(authenticator, 'login').mockResolvedValue(token);
        jest.spyOn(authenticator, 'saveToken');

        const config = Symbol('config');
        await authenticator.tryLogin(config);

        expect(authenticator.saveToken).toHaveBeenCalledWith(token);
      });
    });

    describe('when the password and token are not provided', () => {
      it('should authenticate with oidc, generate an application token and return it', async () => {
        expect.assertions(4);

        const {
          authenticator,
          oidcAuthenticator,
          applicationTokenService,
          fs,
          logger,
          FOREST_D_PATH,
        } = setup();

        oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
        applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');

        await authenticator.tryLogin({});

        expect(logger.error).not.toHaveBeenCalled();
        expect(oidcAuthenticator.authenticate).toHaveBeenCalledWith();
        expect(applicationTokenService.generateApplicationToken).toHaveBeenCalledWith('SESSION-TOKEN');
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          `${FOREST_D_PATH}`,
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
            FOREST_D_PATH,
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
          expect(fs.readFileSync).toHaveBeenNthCalledWith(1, FOREST_PATH, 'utf8');
          expect(fs.readFileSync).toHaveBeenNthCalledWith(2, FOREST_D_PATH, 'utf8');
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

    describe('a forest forest token is found', () => {
      it('removes the ~/.forest.d/.forestrc file and call the api to invalidate the token', () => {
        expect.assertions(2);

        const { authenticator, fs, applicationTokenService } = setup();
        const forestForestToken = Symbol('forestForestToken');
        jest.spyOn(authenticator, 'getVerifiedToken')
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(forestForestToken);

        authenticator.logout();

        expect(fs.unlinkSync).toHaveBeenCalledWith('sweet-home/.forest.d/.forestrc');
        expect(applicationTokenService.deleteApplicationToken)
          .toHaveBeenCalledWith(forestForestToken);
      });
    });

    describe('a forest token is found', () => {
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
    });

    describe('only a lumber token is found', () => {
      it('should do nothing', async () => {
        expect.assertions(3);
        const {
          authenticator, fs, jwtDecode, applicationTokenService,
          LUMBER_PATH, logger,
        } = setup();

        fs.readFileSync
          .mockImplementation(mockGetToken(LUMBER_PATH));
        jwtDecode.mockReturnValue({ exp: (Date.now() / 1000) + 60 });

        await authenticator.logout();

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
