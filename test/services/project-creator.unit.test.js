const ProjectCreator = require('../../src/services/projects/create/project-creator');

describe('project creator', () => {
  describe('when fails', () => {
    const setupTest = () => ({
      assertPresent: () => true,
      api: {
        createProject: jest.fn(),
      },
      chalk: {
        cyan: (msg) => msg,
        red: (msg) => msg,
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

      await projectCreator.create('dummy', {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(
        1,
        1,
        { logs: ['Your session has expired. Please log back in with the command `forest login`.'] },
      );
    });

    it('should handle "Conflict" error', async () => {
      expect.assertions(3);

      const context = setupTest();
      context.api.createProject.mockRejectedValue(new Error('Conflict'));

      const projectCreator = new ProjectCreator(context);

      await projectCreator.create('dummy', {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(
        1,
        1,
        { logs: ['A project with this name already exists. Please choose another name.'] },
      );
    });

    it('should handle unknown error', async () => {
      expect.assertions(3);

      const context = setupTest();
      context.api.createProject.mockRejectedValue('unknown error');

      const projectCreator = new ProjectCreator(context);

      await projectCreator.create('dummy', {});

      expect(context.api.createProject).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenCalledTimes(1);
      expect(context.terminator.terminate).toHaveBeenNthCalledWith(
        1,
        1,
        { logs: ['ERROR_UNEXPECTED: unknown error'] },
      );
    });
  });
});
