const Api = require('../../src/services/api');

describe('services > API', () => {
  function setup() {
    const superagent = {
      post: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnThis(),
      put: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const applicationTokenSerializer = {
      serialize: jest.fn(),
    };

    const applicationTokenDeserializer = {
      deserialize: jest.fn(),
    };

    const env = {
      FOREST_SERVER_URL: 'https://api.test.forestadmin.com',
    };

    const pkg = {
      version: '1.2.3',
    };

    const projectSerializer = { serialize: jest.fn(project => ({ project })) };
    const projectDeserializer = { deserialize: jest.fn(body => body) };
    const environmentSerializer = { serialize: jest.fn(environment => environment) };
    const environmentDeserializer = { deserialize: jest.fn(body => body) };

    const context = {
      superagent,
      projectSerializer,
      projectDeserializer,
      environmentSerializer,
      environmentDeserializer,
      applicationTokenDeserializer,
      applicationTokenSerializer,
      env,
      pkg,
    };

    const api = new Api(context);

    return { ...context, api };
  }

  describe('createApplicationToken', () => {
    it('should send a query with the serialized token', async () => {
      expect.assertions(7);

      const { superagent, api, applicationTokenSerializer, applicationTokenDeserializer } = setup();

      const serializedToken = {
        data: {
          attributes: {
            name: 'the token',
          },
        },
      };

      applicationTokenSerializer.serialize.mockReturnValue(serializedToken);

      const serializedResponseToken = {
        data: {
          id: '42',
          type: 'application-tokens',
          attributes: {
            name: 'the token',
            token: 'APPLICATION-TOKEN',
          },
        },
      };

      superagent.send.mockResolvedValue({ body: serializedResponseToken });

      const deserializedToken = {
        token: 'APPLICATION-TOKEN',
      };

      applicationTokenDeserializer.deserialize.mockResolvedValue(deserializedToken);

      const result = await api.createApplicationToken({ name: 'the token' }, 'SESSION');

      expect(result).toBe(deserializedToken);
      expect(superagent.post).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/application-tokens',
      );
      expect(superagent.set).toHaveBeenCalledWith({
        'forest-origin': 'forest-cli',
        'Content-Type': 'application/json',
        'User-Agent': 'forest-cli@1.2.3',
      });
      expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer SESSION');
      expect(superagent.send).toHaveBeenCalledWith(serializedToken);
      expect(applicationTokenSerializer.serialize).toHaveBeenCalledWith({ name: 'the token' });
      expect(applicationTokenDeserializer.deserialize).toHaveBeenCalledWith(
        serializedResponseToken,
      );
    });
  });

  describe('deleteApplicationToken', () => {
    it('should send a query to delete the application token', async () => {
      expect.assertions(6);

      const { superagent, api } = setup();

      superagent.send.mockResolvedValue(undefined);

      await api.deleteApplicationToken('THE-TOKEN');

      expect(superagent.delete).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/application-tokens',
      );
      expect(superagent.set).toHaveBeenCalledWith('forest-origin', 'forest-cli');
      expect(superagent.set).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(superagent.set).toHaveBeenCalledWith('User-Agent', 'forest-cli@1.2.3');
      expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer THE-TOKEN');
      expect(superagent.send).toHaveBeenCalledWith();
    });
    it('should silence ERR_INVALID_CHAR errors relative to auth token', async () => {
      expect.assertions(1);
      const { superagent, api } = setup();
      const error = new Error('Invalid character in header content ["Authorization"]');
      error.code = 'ERR_INVALID_CHAR';
      superagent.send.mockRejectedValue(error);
      await expect(api.deleteApplicationToken('THE-TOKEN')).resolves.not.toThrow();
    });
    it('should rethrow other errors', async () => {
      expect.assertions(1);
      const { superagent, api } = setup();
      const error = new Error('Some other error');
      superagent.send.mockRejectedValue(error);
      await expect(api.deleteApplicationToken('THE-TOKEN')).rejects.toBe(error);
    });
  });

  describe('inspectInvitationClaim', () => {
    it('posts the claim in the body, never in the URL', async () => {
      expect.assertions(4);

      const { superagent, api } = setup();
      const answer = { inviter: { name: 'Ada', email: 'ada@example.com' }, project: null };
      superagent.send.mockResolvedValue({ status: 200, body: answer });

      await expect(api.inspectInvitationClaim('THE-CLAIM', 'THE-TOKEN')).resolves.toBe(answer);
      expect(superagent.post).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/developer-invitations/claim/inspect',
      );
      expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer THE-TOKEN');
      expect(superagent.send).toHaveBeenCalledWith({ claim: 'THE-CLAIM' });
    });
  });

  describe('inspectInvitationClaim on another success status', () => {
    it('refuses a 2xx other than 200, so a stray 202 never counts as a go', async () => {
      expect.assertions(1);

      const { superagent, api } = setup();
      superagent.send.mockResolvedValue({ status: 202, body: { inviter: {}, project: null } });

      await expect(api.inspectInvitationClaim('THE-CLAIM', 'THE-TOKEN')).rejects.toMatchObject({
        status: 202,
      });
    });
  });

  describe('createProject', () => {
    const conflict = () =>
      Object.assign(new Error('Conflict'), {
        response: { body: { errors: [{ meta: { projectId: '42' } }] } },
      });
    const existing = { id: '42', initializedAt: null, defaultEnvironment: { id: '7' } };

    it('reuses an uninitialized same-name project on a conflict without a claim', async () => {
      expect.assertions(2);

      const { superagent, api } = setup();
      superagent.send
        .mockRejectedValueOnce(conflict())
        .mockResolvedValueOnce({ body: existing })
        .mockResolvedValueOnce({ body: { secretKey: 'env-secret' } });

      const project = await api.createProject({}, 'THE-TOKEN', { name: 'app' });

      expect(superagent.get).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/projects/42',
      );
      expect(project.defaultEnvironment.secretKey).toBe('env-secret');
    });

    it.each([
      [
        'a conflict',
        (send, project) =>
          send.mockRejectedValueOnce(conflict()).mockResolvedValueOnce({ body: project }),
      ],
      ['a 201', (send, project) => send.mockResolvedValueOnce({ body: project })],
    ])(
      'refuses a project outside the requested organization after %s, before touching its environment',
      async (_, answer) => {
        expect.assertions(2);

        const { superagent, api } = setup();
        answer(superagent.send, { ...existing, organizationId: 7 });

        await expect(
          api.createProject({}, 'THE-TOKEN', { name: 'app', organization: { id: 42 } }),
        ).rejects.toThrow(
          'A project named "app" already exists outside organization 42. Please choose another name.',
        );
        expect(superagent.put).not.toHaveBeenCalled();
      },
    );

    it('refuses a Personal-space project when an organization is requested', async () => {
      expect.assertions(1);

      const { superagent, api } = setup();
      superagent.send.mockResolvedValueOnce({ body: { ...existing, organizationId: null } });

      await expect(
        api.createProject({}, 'THE-TOKEN', { name: 'app', organization: { id: 42 } }),
      ).rejects.toThrow('already exists outside organization 42');
    });

    it('keeps a project of the requested organization', async () => {
      expect.assertions(1);

      const { superagent, api } = setup();
      superagent.send
        .mockResolvedValueOnce({ body: { ...existing, organizationId: 42 } })
        .mockResolvedValueOnce({ body: { secretKey: 'env-secret' } });

      const project = await api.createProject({}, 'THE-TOKEN', {
        name: 'app',
        organization: { id: 42 },
      });

      expect(project.defaultEnvironment.secretKey).toBe('env-secret');
    });

    it('never reuses a same-name project on a conflict when a claim is sent', async () => {
      expect.assertions(2);

      const { superagent, api } = setup();
      const error = conflict();
      superagent.send.mockRejectedValueOnce(error);

      await expect(
        api.createProject({}, 'THE-TOKEN', { name: 'app', invitationClaim: 'THE-CLAIM' }),
      ).rejects.toBe(error);
      expect(superagent.get).not.toHaveBeenCalled();
    });
  });

  describe('createProject with an invitation claim', () => {
    const CLAIM = 'THE-CLAIM-abcdefghijklmnopqrstuvwxyz';
    const CONFIGURE_URL =
      'https://api.test.forestadmin.com/api/developer-invitations/claim/configure-environment';
    const created = () => ({ id: '42', initializedAt: null, defaultEnvironment: { id: '7' } });
    const httpError = (status, body) =>
      Object.assign(new Error(`HTTP ${status}`), { status, response: { status, body } });
    const claimRefusal = (status, code) =>
      httpError(status, { errors: [{ detail: 'Refused.', meta: { code } }] });

    function claimedCall(setupAnswers) {
      const context = setup();
      setupAnswers(context.superagent.send);
      const call = context.api.createProject({ appPort: 3000 }, 'THE-TOKEN', {
        name: 'app',
        invitationClaim: CLAIM,
      });

      return { ...context, call };
    }

    function expectClaimOutOfUrls(superagent) {
      const urls = [...superagent.post.mock.calls, ...superagent.put.mock.calls].map(
        ([url]) => url,
      );
      urls.forEach(url => expect(url).not.toContain(CLAIM));
    }

    it.each([
      ['a fresh claim (201)', 201, created()],
      ['a resumed claim (200)', 200, { ...created(), initializedAt: '2026-11-24T00:00:00Z' }],
    ])(
      'configures the environment through the claim route on %s, without the legacy update',
      async (_, status, project) => {
        expect.hasAssertions();

        const { superagent, call } = claimedCall(send =>
          send
            .mockResolvedValueOnce({ status, body: project })
            .mockResolvedValueOnce({ status: 200, body: { secretKey: 'claimed-secret' } }),
        );

        const result = await call;

        expect(result.id).toBe('42');
        expect(result.defaultEnvironment).toMatchObject({
          secretKey: 'claimed-secret',
          apiEndpoint: 'http://localhost:3000',
        });
        expect(superagent.post).toHaveBeenLastCalledWith(CONFIGURE_URL);
        expect(superagent.send).toHaveBeenLastCalledWith({
          claim: CLAIM,
          apiEndpoint: 'http://localhost:3000',
        });
        expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer THE-TOKEN');
        expect(superagent.put).not.toHaveBeenCalled();
        expectClaimOutOfUrls(superagent);
      },
    );

    it('falls back to the legacy environment update when the server predates the claim route', async () => {
      expect.hasAssertions();

      const { superagent, environmentSerializer, call } = claimedCall(send =>
        send
          .mockResolvedValueOnce({ status: 201, body: created() })
          .mockRejectedValueOnce(httpError(404, { errors: [{ detail: 'Not Found' }] }))
          .mockResolvedValueOnce({ body: { secretKey: 'legacy-secret' } }),
      );

      const result = await call;

      expect(result.defaultEnvironment.secretKey).toBe('legacy-secret');
      expect(superagent.put).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/environments/7',
      );
      expect(environmentSerializer.serialize.mock.calls[0][0]).toMatchObject({
        id: '7',
        apiEndpoint: 'http://localhost:3000',
      });
      expect(JSON.stringify(superagent.send.mock.calls[2][0])).not.toContain(CLAIM);
      expectClaimOutOfUrls(superagent);
    });

    it.each([
      ['a claim refusal on a 404', claimRefusal(404, 'developer_invitation_claim_invalid')],
      ['an expired session (401)', httpError(401, {})],
      ['a forbidden caller (403)', httpError(403, {})],
      ['a claim refusal (422)', claimRefusal(422, 'developer_invitation_claim_consumed')],
      ['a server error (500)', httpError(500, {})],
    ])('rethrows %s without the legacy update', async (_, error) => {
      expect.assertions(2);

      const { superagent, call } = claimedCall(send =>
        send.mockResolvedValueOnce({ status: 201, body: created() }).mockRejectedValueOnce(error),
      );

      await expect(call).rejects.toBe(error);
      expect(superagent.put).not.toHaveBeenCalled();
    });

    it.each([
      ['a 2xx other than 200', { status: 202, body: { secretKey: 'claimed-secret' } }],
      ['no secret key', { status: 200, body: {} }],
      ['an empty secret key', { status: 200, body: { secretKey: '' } }],
      ['a non-string secret key', { status: 200, body: { secretKey: 42 } }],
    ])('refuses an answer with %s, without the legacy update', async (_, answer) => {
      expect.assertions(3);

      const { superagent, call } = claimedCall(send =>
        send.mockResolvedValueOnce({ status: 201, body: created() }).mockResolvedValueOnce(answer),
      );

      const error = await call.catch(thrown => thrown);

      expect(error.message).toBe('Unexpected invitation environment answer');
      expect(error.message).not.toContain(CLAIM);
      expect(superagent.put).not.toHaveBeenCalled();
    });

    it('keeps ordinary creation on the legacy environment update', async () => {
      expect.assertions(3);

      const { superagent, api } = setup();
      superagent.send
        .mockResolvedValueOnce({ status: 201, body: created() })
        .mockResolvedValueOnce({ body: { secretKey: 'legacy-secret' } });

      const result = await api.createProject({}, 'THE-TOKEN', { name: 'app' });

      expect(result.defaultEnvironment.secretKey).toBe('legacy-secret');
      expect(superagent.post).not.toHaveBeenCalledWith(CONFIGURE_URL);
      expect(superagent.put).toHaveBeenCalledWith(
        'https://api.test.forestadmin.com/api/environments/7',
      );
    });
  });
});
