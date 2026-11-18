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
});
