const Api = require('../../src/services/api');

describe('services > API', () => {
  function setup() {
    const superagent = {
      post: jest.fn().mockReturnThis(),
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

    const context = {
      superagent,
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
});
