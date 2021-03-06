const Context = require('@forestadmin/context');

const GeneralPrompter = require('../../../src/services/prompter/general-prompter');
const PrompterError = require('../../../src/services/prompter/prompter-error');
const Terminator = require('../../../src/utils/terminator');

const defaultPlan = require('../../../src/context/plan');

const setupTest = () => {
  Context.init(defaultPlan);
};

describe('services > prompter > general prompter', () => {
  let requests = [];
  let program = {};

  function resetParams() {
    requests = [];
    program = {};
  }

  describe('getting the config from prompts', () => {
    describe('when a PromptError is thrown', () => {
      it('should terminate the process', async () => {
        expect.assertions(5);

        setupTest();

        const promptError = new PrompterError('error message', ['logs']);

        const generalPrompter = new GeneralPrompter(requests, program);
        const applicationPromptsStub = jest.spyOn(generalPrompter.applicationPrompt, 'handlePrompts').mockRejectedValue(promptError);
        const projectPromptsStub = jest.spyOn(generalPrompter.projectPrompt, 'handlePrompts').mockRejectedValue(promptError);
        const databasePromptsStub = jest.spyOn(generalPrompter.databasePrompt, 'handlePrompts').mockRejectedValue(promptError);
        const terminateStub = jest.spyOn(Terminator, 'terminate').mockResolvedValue(true);

        await generalPrompter.getConfig();

        const status = terminateStub.mock.calls[0][0];
        const {
          errorCode,
          errorMessage,
          logs,
          context,
        } = terminateStub.mock.calls[0][1];

        expect(status).toStrictEqual(1);
        expect(errorCode).toStrictEqual('unexpected_error');
        expect(errorMessage).toStrictEqual('error message');
        expect(logs).toStrictEqual(['logs']);
        expect(context).toBeUndefined();

        resetParams();
        applicationPromptsStub.mockRestore();
        projectPromptsStub.mockRestore();
        databasePromptsStub.mockRestore();
        terminateStub.mockRestore();
      });
    });
  });
});
