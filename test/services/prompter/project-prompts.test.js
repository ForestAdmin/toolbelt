const chalk = require('chalk');
const sinon = require('sinon');
const fs = require('fs');
const PrompterError = require('../../../src/services/prompter/prompter-error');
const messages = require('../../../src/utils/messages');
const ProjectPrompts = require('../../../src/services/prompter/project-prompts');

const FAKE_PROJECT_NAME = 'fakeProject';

describe('services > prompter > project prompts', () => {
  let env = {};
  let requests = [];
  let program = {
    args: [],
  };

  function resetParams() {
    env = {};
    requests = [];
    program = {
      args: [],
    };
  }

  describe('handling project related prompts', () => {
    it('should handle the project name', async () => {
      expect.assertions(1);
      program.args = [FAKE_PROJECT_NAME];
      const projectPrompts = new ProjectPrompts(requests, env, program);
      const nameHandlerStub = sinon.stub(projectPrompts, 'handleName');
      await projectPrompts.handlePrompts();

      expect(nameHandlerStub.calledOnce).toStrictEqual(true);
      resetParams();
    });
  });

  describe('handling project name prompt', () => {
    describe('when the applicationName option is requested', () => {
      describe('and the projectName has not been passed in', () => {
        it('should throw a prompter error', async () => {
          expect.assertions(2);
          requests.push('applicationName');
          const projectPrompts = new ProjectPrompts(requests, env, program);

          const handleName = projectPrompts.handleName();
          await expect(handleName).rejects.toThrow(PrompterError);
          await expect(handleName).rejects.toThrow(messages.ERROR_MISSING_PROJECT_NAME);
        });
      });

      describe('and the projectName has already been passed in', () => {
        function getProjectPrompts() {
          program.applicationName = FAKE_PROJECT_NAME;
          return new ProjectPrompts(requests, env, program);
        }

        describe('and the directory to write in is not available', () => {
          it('should throw a prompter error', async () => {
            expect.assertions(2);
            requests.push('applicationName');
            const projectPrompts = getProjectPrompts();
            fs.mkdirSync(`${process.cwd()}/${FAKE_PROJECT_NAME}`);

            const message = `The directory ${chalk.red(`${process.cwd()}/${program.applicationName}`)} already exists.`;
            const handleName = projectPrompts.handleName();
            await expect(handleName).rejects.toThrow(PrompterError);
            await expect(handleName).rejects.toThrow(message);
            fs.rmdirSync(`${process.cwd()}/${FAKE_PROJECT_NAME}`);
          });
        });

        describe('and the directory to write in is available', () => {
          it('should add the applicationName to the configuration', async () => {
            expect.assertions(2);
            requests.push('applicationName');
            const projectPrompts = getProjectPrompts();
            expect(env.applicationName).toBeUndefined();

            await projectPrompts.handleName();
            expect(env.applicationName).toStrictEqual(FAKE_PROJECT_NAME);
          });
        });
      });
    });

    describe('when the applicationName option is not requested', () => {
      it('should not do anything', async () => {
        expect.assertions(2);
        resetParams();
        program.args = [FAKE_PROJECT_NAME];
        const projectPrompts = new ProjectPrompts(requests, env, program);
        expect(env.applicationName).toBeUndefined();

        await projectPrompts.handleName();
        expect(env.applicationName).toBeUndefined();
      });
    });
  });
});
