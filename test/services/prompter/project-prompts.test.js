const chalk = require('chalk');
const path = require('path');

const PrompterError = require('../../../src/services/prompter/prompter-error');
const messages = require('../../../src/utils/messages');
const ProjectPrompts = require('../../../src/services/prompter/project-prompts');

const EXISTING_PROJECT_NAME = '_fake_project_directory';
const NO_SUCH_PROJECT_NAME = '_no_such_project_directory';

describe('services > prompter > project prompts', () => {
  function makeParams() {
    return {
      env: {},
      requests: [],
      program: {
        args: [],
      },
    };
  }

  describe('handling project related prompts', () => {
    it('should handle the project name', async () => {
      expect.assertions(1);

      const { env, requests, program } = makeParams();
      program.args = [NO_SUCH_PROJECT_NAME];

      const projectPrompts = new ProjectPrompts(requests, env, {}, program);
      const nameHandlerStub = jest.spyOn(projectPrompts, 'handleName');
      await projectPrompts.handlePrompts();

      expect(nameHandlerStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('handling project name prompt', () => {
    describe('when the applicationName option is requested', () => {
      describe('and the projectName has not been passed in', () => {
        it('should throw a prompter error', async () => {
          expect.assertions(2);

          const { env, requests, program } = makeParams();
          requests.push('applicationName');
          const projectPrompts = new ProjectPrompts(requests, env, {}, program);
          const handleName = projectPrompts.handleName();

          await expect(handleName).rejects.toThrow(PrompterError);
          await expect(handleName).rejects.toThrow(messages.ERROR_MISSING_PROJECT_NAME);
        });
      });

      describe('and the projectName has already been passed in', () => {
        describe('and the directory to write in is not available', () => {
          it('should throw a prompter error', async () => {
            expect.assertions(2);

            const { env, requests, program } = makeParams();
            requests.push('applicationName');
            program.applicationName = path.join(__dirname, EXISTING_PROJECT_NAME);
            const projectPrompts = new ProjectPrompts(requests, env, {}, program);
            const handleName = projectPrompts.handleName();

            await expect(handleName).rejects.toThrow(PrompterError);
            const expectedErrorMessage = `File or directory "${chalk.red(
              `${program.applicationName}`,
            )}" already exists.`;
            await expect(handleName).rejects.toThrow(expectedErrorMessage);
          });
        });

        describe('and the directory to write in is available', () => {
          it('should add the applicationName to the configuration', async () => {
            expect.assertions(2);

            const { env, requests, program } = makeParams();
            requests.push('applicationName');
            program.applicationName = path.join(__dirname, NO_SUCH_PROJECT_NAME);
            const projectPrompts = new ProjectPrompts(requests, env, {}, program);

            expect(env.applicationName).toBeUndefined();

            await projectPrompts.handleName();

            expect(env.applicationName).toStrictEqual(program.applicationName);
          });
        });
      });
    });

    describe('when the applicationName option is not requested', () => {
      it('should not do anything', async () => {
        expect.assertions(2);

        const { env, requests, program } = makeParams();
        program.args = [NO_SUCH_PROJECT_NAME];
        const projectPrompts = new ProjectPrompts(requests, env, {}, program);

        expect(env.applicationName).toBeUndefined();

        await projectPrompts.handleName();

        expect(env.applicationName).toBeUndefined();
      });
    });
  });
});
