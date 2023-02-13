const ProjectCreator = require('../../src/services/projects/create/project-creator');

describe('project creator', () => {
  function createContext() {
    const api = {
      createProject: jest.fn(),
    };

    const chalk = {};

    const keyGenerator = {
      generate: jest.fn(),
    };

    const messages = {};

    const terminator = {
      terminate: jest.fn(),
    };

    return {
      api,
      chalk,
      keyGenerator,
      messages,
      terminator,
      assertPresent: jest.fn(),
    };
  }

  describe('when fails', () => {
    const setupTest = () => ({
      assertPresent: () => true,
      api: {
        createProject: jest.fn(),
      },
      chalk: {
        cyan: msg => msg,
        red: msg => msg,
      },
      keyGenerator: {},
      messages: {
        ERROR_UNEXPECTED: 'ERROR_UNEXPECTED:',
      },
      terminator: {
        terminate: jest.fn(),
      },
    });

    it('should handle "Unauthorized" error', async () => {
      expect.assertions(3);

      const context = setupTest();
      context.api.createProject.mockRejectedValue(new Error('Unauthorized'));

      const projectCreator = new ProjectCreator(context);

      await projectCreator.create('dummy', {}, {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(1, 1, {
        logs: ['Your session has expired. Please log back in with the command `forest login`.'],
      });
    });

    it('should handle "Conflict" error', async () => {
      expect.assertions(3);

      const context = setupTest();
      context.api.createProject.mockRejectedValue(new Error('Conflict'));

      const projectCreator = new ProjectCreator(context);

      await projectCreator.create('dummy', {}, {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(1, 1, {
        logs: ['A project with this name already exists. Please choose another name.'],
      });
    });

    it('should handle unknown error', async () => {
      expect.assertions(3);

      const context = setupTest();
      context.api.createProject.mockRejectedValue('unknown error');

      const projectCreator = new ProjectCreator(context);

      await projectCreator.create('dummy', {}, {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(1, 1, {
        logs: ['ERROR_UNEXPECTED: unknown error'],
      });
    });
  });

  describe('when creating the project', () => {
    it('should call the API with the right parameters and return the env secret', async () => {
      expect.assertions(3);
      const context = createContext();
      const projectCreator = new ProjectCreator(context);

      const sessionToken = 'session-token';
      const config = {
        applicationName: 'New application',
      };
      const meta = {
        agent: 'forest-express-sequelize',
        architecture: 'microservice',
        dbDialect: 'postgres',
      };

      const apiResponse = {
        id: 'project-id',
        defaultEnvironment: {
          secretKey: 'secret-key',
        },
      };
      context.api.createProject.mockResolvedValue(apiResponse);
      context.keyGenerator.generate.mockReturnValue('generated-key');

      const result = await projectCreator.create(sessionToken, config, meta);

      expect(context.api.createProject).toHaveBeenCalledWith(config, sessionToken, {
        name: 'New application',
        agent: 'forest-express-sequelize',
        architecture: 'microservice',
        databaseType: 'postgres',
      });
      expect(context.keyGenerator.generate).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual({
        id: 'project-id',
        envSecret: 'secret-key',
        authSecret: 'generated-key',
      });
    });
  });
});
