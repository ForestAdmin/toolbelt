import type Open from 'open';
import type { Client, DeviceFlowHandle, Issuer } from 'openid-client';

import OidcError from './error';

export default class OidcAuthenticator {
  private readonly openIdClient: Client;

  private readonly env: Record<string, string>;

  private readonly process: NodeJS.Process;

  private readonly open: typeof Open;

  constructor({
    assertPresent,
    openIdClient,
    env,
    process,
    open,
  }: {
    assertPresent: (args: unknown) => void;
    openIdClient: Client;
    env: Record<string, string>;
    process: NodeJS.Process;
    open: typeof Open;
  }) {
    assertPresent({
      openIdClient,
      env,
      process,
      open,
    });

    this.openIdClient = openIdClient;
    this.env = env;
    this.process = process;
    this.open = open;
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

      await this.open(flow.verification_uri_complete);

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

  public async authenticate() {
    const client = await this.register();

    const flow = await OidcAuthenticator.launchDeviceAuthorization(client);

    const tokenSet = await this.waitForAuthentication(flow);

    return tokenSet.access_token;
  }
}
