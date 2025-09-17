import OidcAuthenticator from '../../../src/services/oidc/authenticator';
import OidcError from '../../../src/services/oidc/error';

describe('services > Oidc > Authenticator', () => {
  function setupTest() {
    const flow = {
      poll: jest.fn(),
      expired: jest.fn(),
      verification_uri: 'https://verification.forest',
      verification_uri_complete: 'https://verification.forest?user_code=ABCD',
      user_code: 'ABC',
      expires_in: 100,
    };

    const client = {
      deviceAuthorization: jest.fn(),
    };

    const issuer = {
      Client: {
        register: jest.fn(),
      },
    };

    const open = jest.fn();

    const context = {
      assertPresent: jest.fn(),
      env: {
        FOREST_SERVER_URL: 'https://forest.admin',
      },
      process: {
        stdout: {
          write: jest.fn(),
        },
      },
      openIdClient: {
        Issuer: {
          discover: jest.fn().mockReturnValue(issuer),
        },
      },
      open,
      logger: {
        log: jest.fn(),
        WARN: Symbol('warn'),
      },
    };

    const authenticator = new OidcAuthenticator(
      context as unknown as ConstructorParameters<typeof OidcAuthenticator>[0],
    );

    return {
      ...context,
      authenticator,
      client,
      issuer,
      flow,
      context,
    };
  }

  describe('dependencies', () => {
    it('should assert that all dependencies are present', () => {
      expect.assertions(1);
      const { context } = setupTest();
      const { assertPresent, ...dependencies } = context;

      expect(assertPresent).toHaveBeenCalledWith(dependencies);
    });
  });

  describe('authenticate', () => {
    it('should successfully authenticate the user', async () => {
      expect.assertions(7);
      const { authenticator, issuer, client, flow, openIdClient, process, open } = setupTest();

      const tokenSet = {
        access_token: 'THE-TOKEN',
      };

      openIdClient.Issuer.discover.mockReturnValue(Promise.resolve(issuer));
      issuer.Client.register.mockReturnValue(Promise.resolve(client));
      client.deviceAuthorization.mockReturnValue(Promise.resolve(flow));
      flow.poll.mockReturnValue(Promise.resolve(tokenSet));

      const token = await authenticator.authenticate();

      expect(token).toBe('THE-TOKEN');
      expect(openIdClient.Issuer.discover).toHaveBeenCalledWith(
        'https://forest.admin/oidc/.well-known/openid-configuration',
      );
      expect(issuer.Client.register).toHaveBeenCalledWith({
        name: 'forest-cli',
        application_type: 'native',
        redirect_uris: ['com.forestadmin.cli://authenticate'],
        token_endpoint_auth_method: 'none',
        grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
        response_types: ['none'],
      });
      expect(client.deviceAuthorization).toHaveBeenCalledWith({
        scopes: ['openid', 'email', 'profile'],
      });
      expect(process.stdout.write).toHaveBeenNthCalledWith(
        1,
        'Click on "Log in" on the browser tab which opened automatically or open this link: https://verification.forest?user_code=ABCD\n',
      );
      expect(process.stdout.write).toHaveBeenNthCalledWith(2, 'Your confirmation code: ABC\n');
      expect(open).toHaveBeenCalledWith('https://verification.forest?user_code=ABCD');
    });

    it('should throw a specific error when the issuer discovery returned an error', async () => {
      expect.assertions(2);
      const { authenticator, openIdClient } = setupTest();

      const error = new Error('The error');

      openIdClient.Issuer.discover.mockReturnValue(Promise.reject(error));

      const promise = authenticator.authenticate();

      await expect(promise).rejects.toBeInstanceOf(OidcError);
      await expect(promise).rejects.toHaveProperty(
        'message',
        'Unable to register against the Forest Admin server: The error.',
      );
    });

    it('should throw a specific error when the client registration returned an error', async () => {
      expect.assertions(2);
      const { authenticator, openIdClient, issuer } = setupTest();

      const error = new Error('The error');

      openIdClient.Issuer.discover.mockReturnValue(Promise.resolve(issuer));
      issuer.Client.register.mockReturnValue(Promise.reject(error));

      const promise = authenticator.authenticate();

      await expect(promise).rejects.toBeInstanceOf(OidcError);
      await expect(promise).rejects.toHaveProperty(
        'message',
        'Unable to register against the Forest Admin server: The error.',
      );
    });

    it('should throw a specific error when the device authentication returned an error', async () => {
      expect.assertions(2);
      const { authenticator, openIdClient, issuer, client } = setupTest();

      const error = new Error('The error');

      openIdClient.Issuer.discover.mockReturnValue(Promise.resolve(issuer));
      issuer.Client.register.mockReturnValue(Promise.resolve(client));
      client.deviceAuthorization.mockReturnValue(Promise.reject(error));

      const promise = authenticator.authenticate();

      await expect(promise).rejects.toBeInstanceOf(OidcError);
      await expect(promise).rejects.toHaveProperty(
        'message',
        'Error while starting the authentication flow: The error.',
      );
    });

    it('should throw a specific error when the polling returned an error', async () => {
      expect.assertions(2);
      const { authenticator, openIdClient, issuer, client, flow } = setupTest();

      const error = new Error('The error');

      openIdClient.Issuer.discover.mockReturnValue(Promise.resolve(issuer));
      issuer.Client.register.mockReturnValue(Promise.resolve(client));
      client.deviceAuthorization.mockReturnValue(Promise.resolve(flow));
      flow.poll.mockReturnValue(Promise.reject(error));
      flow.expired.mockReturnValue(false);

      const promise = authenticator.authenticate();

      await expect(promise).rejects.toBeInstanceOf(OidcError);
      await expect(promise).rejects.toHaveProperty(
        'message',
        'Error during the authentication: The error.',
      );
    });

    it('should throw a specific error when the polling expired', async () => {
      expect.assertions(3);
      const { authenticator, openIdClient, issuer, client, flow } = setupTest();

      const error = new Error('The error');

      openIdClient.Issuer.discover.mockReturnValue(Promise.resolve(issuer));
      issuer.Client.register.mockReturnValue(Promise.resolve(client));
      client.deviceAuthorization.mockReturnValue(Promise.resolve(flow));

      let reject;
      const flowPromise = new Promise((resolve, internalReject) => {
        reject = internalReject;
      });

      flow.poll.mockReturnValue(flowPromise);
      flow.expired.mockReturnValue(true);

      const promise = authenticator.authenticate();

      await new Promise(resolve => setImmediate(resolve));

      flow.expires_in = 0;
      reject(error);

      await expect(promise).rejects.toBeInstanceOf(OidcError);
      await expect(promise).rejects.toHaveProperty(
        'message',
        'The authentication request expired. Please try to login a second time, and complete the authentication within 100 seconds.',
      );
      await expect(promise).rejects.not.toHaveProperty('reason');
    });

    it('should log a warning when the browser cannot be opened', async () => {
      expect.assertions(3);

      const { open, authenticator, logger, openIdClient, issuer, client, flow } = setupTest();

      openIdClient.Issuer.discover.mockResolvedValue(issuer);
      issuer.Client.register.mockResolvedValue(client);
      client.deviceAuthorization.mockResolvedValue(flow);

      flow.poll.mockResolvedValue({
        access_token: 'THE-TOKEN',
      });
      open.mockRejectedValue(new Error('The error'));

      await expect(authenticator.authenticate()).resolves.toBe('THE-TOKEN');

      expect(open).toHaveBeenCalledWith('https://verification.forest?user_code=ABCD');

      expect(logger.log).toHaveBeenCalledWith(
        logger.WARN,
        'Unable to open the browser: The error. Please open the link manually.',
      );
    });
  });
});
