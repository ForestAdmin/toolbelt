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

    it('should handle "Conflict" error', async () => {
      expect.assertions(2);

      const context = setupTest();
      context.api.createProject.mockRejectedValue(new Error('Conflict'));

      const projectCreator = new ProjectCreator(context);

      await expect(() => projectCreator.create('dummy', {}, {})).rejects.toThrow(
        'A project with this name already exists. Please choose another name.',
      );

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
    });

    it('should not relabel an invitation refusal as a name conflict', async () => {
      expect.assertions(1);

      const context = setupTest();
      const refusal = Object.assign(new Error('Conflict'), {
        response: {
          body: {
            errors: [{ detail: 'Expired.', meta: { code: 'developer_invitation_claim_expired' } }],
          },
        },
      });
      context.api.createProject.mockRejectedValue(refusal);

      const projectCreator = new ProjectCreator(context);

      await expect(projectCreator.create('dummy', {}, {}, 'claim')).rejects.toThrow('Conflict');
    });
  });

  describe('when creating the project', () => {
    it('should call the API with the right parameters and return the env secret', async () => {
      expect.assertions(3);
      const context = createContext();
      const projectCreator = new ProjectCreator(context);

      const sessionToken = 'session-token';
      const config = {
        appName: 'New application',
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
          apiEndpoint: 'http://localhost:3310',
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
        endpoint: 'http://localhost:3310',
      });
    });

    it('should send the invitation claim when one is given', async () => {
      expect.assertions(1);
      const context = createContext();
      const projectCreator = new ProjectCreator(context);
      context.api.createProject.mockResolvedValue({ id: '1', defaultEnvironment: {} });

      await projectCreator.create(
        'session-token',
        { appName: 'app' },
        { agent: 'nodejs' },
        'CLAIM',
      );

      expect(context.api.createProject).toHaveBeenCalledWith({ appName: 'app' }, 'session-token', {
        name: 'app',
        agent: 'nodejs',
        architecture: undefined,
        databaseType: undefined,
        invitationClaim: 'CLAIM',
      });
    });

    it('should not send the invitation claim key when none is given', async () => {
      expect.assertions(2);
      const context = createContext();
      const projectCreator = new ProjectCreator(context);
      context.api.createProject.mockResolvedValue({ id: '1', defaultEnvironment: {} });

      await projectCreator.create('session-token', { appName: 'app' }, { agent: 'nodejs' });

      expect(context.api.createProject).toHaveBeenCalledWith({ appName: 'app' }, 'session-token', {
        name: 'app',
        agent: 'nodejs',
        architecture: undefined,
        databaseType: undefined,
      });
      expect(context.api.createProject.mock.calls[0][2]).not.toHaveProperty('invitationClaim');
    });
  });

  describe('when an organization is requested', () => {
    const meta = {
      agent: 'nodejs',
      architecture: 'microservice',
      dbDialect: null,
      organizationId: 42,
    };

    it('should send it as the organization relationship of the project', async () => {
      expect.assertions(1);
      const context = createContext();
      context.api.createProject.mockResolvedValue({
        id: '1',
        defaultEnvironment: { secretKey: 'secret-key', apiEndpoint: 'http://localhost:3310' },
      });

      await new ProjectCreator(context).create('token', { appName: 'app' }, meta);

      expect(context.api.createProject).toHaveBeenCalledWith({ appName: 'app' }, 'token', {
        name: 'app',
        agent: 'nodejs',
        architecture: 'microservice',
        databaseType: null,
        organization: { id: 42 },
      });
    });

    it('should name the organization and the server reason when the server refuses it', async () => {
      expect.assertions(2);
      const context = createContext();
      const forbidden = Object.assign(new Error('Forbidden'), {
        status: 403,
        response: {
          body: {
            errors: [
              {
                status: 403,
                detail: 'You are not the owner of the organization',
                name: 'UserNotOwnerOfOrganizationError',
              },
            ],
          },
        },
      });
      context.api.createProject.mockRejectedValue(forbidden);

      const creation = new ProjectCreator(context).create('token', { appName: 'app' }, meta);

      await expect(creation).rejects.toThrow(
        'Cannot create the project in organization 42: You are not the owner of the organization.',
      );
      // Not a 403 any more: the command would print it as a project permission problem.
      await expect(creation).rejects.not.toHaveProperty('status');
    });

    it('should leave any other 403 to the generic permission handling', async () => {
      expect.assertions(1);
      const context = createContext();
      const forbidden = Object.assign(new Error('Forbidden'), {
        status: 403,
        response: {
          body: { errors: [{ status: 403, detail: 'Forbidden', name: 'ForbiddenError' }] },
        },
      });
      context.api.createProject.mockRejectedValue(forbidden);

      await expect(
        new ProjectCreator(context).create('token', { appName: 'app' }, meta),
      ).rejects.toBe(forbidden);
    });

    it('should keep the conflict message when the name is already taken', async () => {
      expect.assertions(1);
      const context = createContext();
      context.api.createProject.mockRejectedValue(new Error('Conflict'));

      await expect(
        new ProjectCreator(context).create('token', { appName: 'app' }, meta),
      ).rejects.toThrow('A project with this name already exists. Please choose another name.');
    });
  });

  it('should leave a 403 untouched when no organization was requested', async () => {
    expect.assertions(1);
    const context = createContext();
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    context.api.createProject.mockRejectedValue(forbidden);

    await expect(
      new ProjectCreator(context).create('token', { appName: 'app' }, { agent: 'nodejs' }),
    ).rejects.toBe(forbidden);
  });
});
