import type Open from 'open';
import type { Client, DeviceFlowHandle, Issuer } from 'openid-client';

import OidcError from './error';

export default class OidcAuthenticator {
  private readonly openIdClient: Client;

  private readonly env: Record<string, string>;

  private readonly process: NodeJS.Process;

  private readonly open: typeof Open;

  private readonly logger: Logger;

  constructor({
    assertPresent,
    openIdClient,
    env,
    process,
    open,
    logger,
  }: {
    assertPresent: (args: unknown) => void;
    openIdClient: Client;
    env: Record<string, string>;
    process: NodeJS.Process;
    open: typeof Open;
    logger: Logger;
  }) {
    assertPresent({
      openIdClient,
      env,
      process,
      open,
      logger,
    });

    this.openIdClient = openIdClient;
    this.env = env;
    this.process = process;
    this.open = open;
    this.logger = logger;
  }

  private async register() {
    try {
      const issuer = await (this.openIdClient.Issuer as typeof Issuer<Client>).discover(
        `${this.env.FOREST_SERVER_URL}/oidc/.well-known/openid-configuration`,
      );

      return await (issuer.Client as unknown as typeof Client).register({
        name: 'forest-cli',
        application_type: 'native',
        redirect_uris: ['com.forestadmin.cli://authenticate'],
        token_endpoint_auth_method: 'none',
        grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
        response_types: ['none'],
      });
    } catch (e) {
      throw new OidcError('Unable to register against the Forest Admin server', e);
    }
  }

  private static async launchDeviceAuthorization(client: Client) {
    try {
      return await client.deviceAuthorization({
        scopes: ['openid', 'email', 'profile'],
      });
    } catch (e) {
      throw new OidcError('Error while starting the authentication flow', e);
    }
  }

  private async waitForAuthentication(flow: DeviceFlowHandle<Client>) {
    const expiresIn = flow.expires_in;
    try {
      this.process.stdout.write(
        `Click on "Log in" on the browser tab which opened automatically or open this link: ${flow.verification_uri_complete}\n`,
      );
      this.process.stdout.write(`Your confirmation code: ${flow.user_code}\n`);

      await this.tryOpen(flow.verification_uri_complete);

      return await flow.poll();
    } catch (e) {
      if (flow.expired()) {
        throw new OidcError(
          'The authentication request expired',
          undefined,
          `Please try to login a second time, and complete the authentication within ${expiresIn} seconds`,
        );
      }

      throw new OidcError('Error during the authentication', e);
    }
  }

  private async tryOpen(url: string) {
    try {
      await this.open(url);
    } catch (e) {
      this.logger.log(
        this.logger.WARN,
        `Unable to open the browser: ${e.message}. Please open the link manually.`,
      );
    }
  }

  public async authenticate() {
    const client = await this.register();

    const flow = await OidcAuthenticator.launchDeviceAuthorization(client);

    const tokenSet = await this.waitForAuthentication(flow);

    return tokenSet.access_token;
  }
}
