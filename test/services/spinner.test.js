const Spinner = require('../../src/services/spinner');

describe('spinner', () => {
  describe('running on promise', () => {
    describe('when promise resolves', () => {
      const spinner = new Spinner();
      const spinnnerOptions = { text: 'valid' };
      const promise = async () => 'test';

      it('should return the promise value', async () => {
        expect.assertions(1);
        spinner.start(spinnnerOptions);
        const result = await spinner.attachToPromise(promise());
        expect(result).toStrictEqual('test');
      });

      it('should display the options text', async () => {
        expect.assertions(1);
        spinner.start(spinnnerOptions);
        const spy = jest.spyOn(spinner, 'success');
        await spinner.attachToPromise(promise());
        expect(spy).toHaveBeenCalledWith(spinnnerOptions);
      });
    });

    describe('when promise fails', () => {
      const spinner = new Spinner();
      const spinnnerOptions = { text: 'invalid' };
      const error = new Error('wrong');
      const promise = async () => { throw error; };

      // NOTICE: Cannot use jest expect().toThrow() on promises
      it('should display the error content and throw an error', async () => {
        expect.assertions(2);
        const spy = jest.spyOn(spinner, 'fail');
        let message;

        spinner.start(spinnnerOptions);

        try {
          await spinner.attachToPromise(promise());
        } catch (e) {
          message = e.message;
        }

        expect(message).toBe('wrong');
        expect(spy).toHaveBeenCalledWith({ text: error });
      });
    });
  });
});
