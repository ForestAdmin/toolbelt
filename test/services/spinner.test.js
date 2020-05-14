const Spinner = require('../../src/services/spinner');

describe('spinner', () => {
  describe('running on promise', () => {
    describe('when promise resolves', () => {
      const spinner = new Spinner();
      const promise = async () => 'test';

      it('should return the promise value', async () => {
        expect.assertions(1);
        const result = await spinner.runOnPromise({ text: 'valid' }, promise());
        expect(result).toStrictEqual('test');
      });

      it('should display the options text', async () => {
        expect.assertions(1);
        const spy = jest.spyOn(spinner, 'success');
        await spinner.runOnPromise({ text: 'valid' }, promise());
        expect(spy).toHaveBeenCalledWith({ text: 'valid' });
      });
    });

    describe('when promise fails', () => {
      const spinner = new Spinner();
      const error = new Error('wrong');
      const promise = async () => { throw error; };

      it('should display the error content', async () => {
        expect.assertions(1);
        const spy = jest.spyOn(spinner, 'fail');
        await spinner.runOnPromise({ text: 'valid' }, promise());
        expect(spy).toHaveBeenCalledWith({ text: error });
      });
    });
  });
});
