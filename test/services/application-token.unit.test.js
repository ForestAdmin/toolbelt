const ApplicationTokenService = require('../../src/services/application-token');

const SESSION_TOKEN = 'SESSION-TOKEN';

describe('services > ApplicationToken', () => {
  function setup() {
    const os = {
      hostname: jest.fn(),
    };

    const api = {
      createApplicationToken: jest.fn(),
      deleteApplicationToken: jest.fn(),
    };

    const context = { api, os };

    const applicationTokenService = new ApplicationTokenService(context);

    return { ...context, applicationTokenService };
  }

  describe('generateApplicationToken', () => {
    it('should call the api to generate a new application token and return its value', async () => {
      expect.assertions(3);

      const { api, os, applicationTokenService } = setup();

      os.hostname.mockReturnValue('Machine name');
      api.createApplicationToken.mockReturnValue({ token: 'ABCDE' });

      const result = await applicationTokenService.generateApplicationToken(SESSION_TOKEN);

      expect(result).toStrictEqual('ABCDE');
      expect(os.hostname).toHaveBeenCalledWith();
      expect(api.createApplicationToken).toHaveBeenCalledWith({
        name: 'forest-cli @Machine name',
      }, SESSION_TOKEN);
    });

    it('should throw an error if something goes wrong with the API', async () => {
      expect.assertions(1);

      const { api, os, applicationTokenService } = setup();

      os.hostname.mockReturnValue('Machine name');
      api.createApplicationToken.mockRejectedValue(new Error('Internal error'));

      await expect(applicationTokenService.generateApplicationToken(SESSION_TOKEN))
        .rejects.toHaveProperty('message', 'Unable to create an application token: Internal error.');
    });
  });

  describe('deleteApplicationToken', () => {
    it('should call the api to delete the current token', async () => {
      expect.assertions(1);

      const { api, applicationTokenService } = setup();

      api.deleteApplicationToken.mockResolvedValue(undefined);

      await applicationTokenService.deleteApplicationToken('TOKEN');

      expect(api.deleteApplicationToken).toHaveBeenCalledWith('TOKEN');
    });

    it('should catch 404 errors and resolve anyway', async () => {
      expect.assertions(1);

      const { api, applicationTokenService } = setup();

      api.deleteApplicationToken.mockRejectedValue({ status: 404 });

      await applicationTokenService.deleteApplicationToken('TOKEN');

      expect(api.deleteApplicationToken).toHaveBeenCalledWith('TOKEN');
    });

    it('should propagate errors that are non 404s', async () => {
      expect.assertions(1);

      const { api, applicationTokenService } = setup();

      const error = new Error('The error');

      api.deleteApplicationToken.mockRejectedValue(error);

      await expect(applicationTokenService.deleteApplicationToken('TOKEN')).rejects.toBe(error);
    });
  });
});
