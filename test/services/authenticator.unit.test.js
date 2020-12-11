const Authenticator = require('../../src/services/authenticator');

describe('services > authenticator', () => {
  function setup() {
    const oidcAuthenticator = {
      authenticate: jest.fn(),
    };
    const applicationTokenService = {
      generateApplicationToken: jest.fn(),
    };

    const os = {
      homedir: jest.fn(),
    };

    const fs = {
      unlinkSync: jest.fn(),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
    };

    const chalk = {
      red: jest.fn().mockImplementation((value) => `[red]${value}[/red]`),
    };

    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };

    const jwtDecode = jest.fn();

    const context = {
      oidcAuthenticator,
      applicationTokenService,
      os,
      fs,
      chalk,
      logger,
      jwtDecode,
    };
    const authenticator = new Authenticator(context);

    return { ...context, authenticator };
  }

  describe('tryLogin', () => {
    describe('when the password and token are not provided', () => {
      it('should authenticate with oidc, generate an application token and return it', async () => {
        expect.assertions(4);

        const {
          authenticator,
          oidcAuthenticator,
          applicationTokenService,
          os,
          fs,
          logger,
        } = setup();

        oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
        applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');
        os.homedir.mockReturnValue('~');

        await authenticator.tryLogin({});

        expect(logger.error).not.toHaveBeenCalled();
        expect(oidcAuthenticator.authenticate).toHaveBeenCalledWith();
        expect(applicationTokenService.generateApplicationToken).toHaveBeenCalledWith('SESSION-TOKEN');
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '~/.forestrc',
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
            os,
            fs,
            logger,
            jwtDecode,
          } = setup();

          oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
          applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');
          os.homedir.mockReturnValue('~');
          fs.readFileSync.mockImplementation((path) => {
            if (path === '~/.forestrc') return 'PREVIOUS-TOKEN';
            return '';
          });
          jwtDecode.mockReturnValue({ exp: (Date.now().valueOf() / 1000) + 5000 });

          await authenticator.tryLogin({});

          expect(logger.error).not.toHaveBeenCalled();
          expect(fs.readFileSync).toHaveBeenCalledWith('~/.forestrc', 'utf8');
          expect(fs.readFileSync).toHaveBeenCalledWith('~/.lumberrc', 'utf8');
          expect(jwtDecode).toHaveBeenCalledWith('PREVIOUS-TOKEN');
          expect(fs.unlinkSync).toHaveBeenCalledWith('~/.forestrc');
        });
      });

      describe('when the token is saved in lumberrc', () => {
        it('should not delete the lumberrc file', async () => {
          expect.assertions(2);

          const {
            authenticator,
            oidcAuthenticator,
            applicationTokenService,
            os,
            fs,
            logger,
            jwtDecode,
          } = setup();

          oidcAuthenticator.authenticate.mockResolvedValue('SESSION-TOKEN');
          applicationTokenService.generateApplicationToken.mockResolvedValue('APP-TOKEN');
          os.homedir.mockReturnValue('~');
          fs.readFileSync.mockImplementation((path) => {
            if (path === '~/.lumberrc') return 'PREVIOUS-TOKEN';
            return '';
          });
          jwtDecode.mockReturnValue({ exp: (Date.now().valueOf() / 1000) + 5000 });

          await authenticator.tryLogin({});

          expect(logger.error).not.toHaveBeenCalled();
          expect(fs.unlinkSync).not.toHaveBeenCalledWith('~/.lumberrc');
        });
      });
    });
  });
});
