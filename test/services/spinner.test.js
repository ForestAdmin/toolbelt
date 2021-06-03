const Spinner = require('../../src/services/spinner');

describe('spinner', () => {
  describe('running on promise', () => {
    describe('when promise resolves', () => {
      const spinnnerOptions = { text: 'valid' };
      const promise = async () => 'test';

      it('should return the promise value', async () => {
        expect.assertions(1);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        const result = await spinner.attachToPromise(promise());
        expect(result).toStrictEqual('test');
      });

      it('should display the options text', async () => {
        expect.assertions(1);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        const spy = jest.spyOn(spinner, 'success');
        await spinner.attachToPromise(promise());
        expect(spy).toHaveBeenCalledWith(spinnnerOptions);
      });
    });

    describe('when promise fails', () => {
      const spinnnerOptions = { text: 'invalid' };
      const error = new Error('wrong');
      const promise = async () => { throw error; };

      // NOTICE: Cannot use jest expect().toThrow() on promises
      it('should display the error content and throw an error', async () => {
        expect.assertions(2);
        const spinner = new Spinner();
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

  describe('when calling pause', () => {
    const spinnnerOptions = { text: 'trying to pause' };

    describe('when no spinner is running', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        expect(() => spinner.pause()).toThrow('No spinner is running.');
      });
    });

    describe('when a spinner is running', () => {
      it('should pause the spinner correctly', () => {
        expect.assertions(2);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        spinner.pause();
        expect(spinner.isRunning()).toBe(false);
        expect(spinner.pausedSpinnerOptions).toStrictEqual(spinnnerOptions);
      });
    });
  });

  describe('when calling continue', () => {
    const spinnnerOptions = { text: 'trying to continue' };

    describe('when no spinner is running', () => {
      describe('when the spinner never started', () => {
        it('should throw an error', () => {
          expect.assertions(1);
          const spinner = new Spinner();
          expect(() => spinner.continue()).toThrow('No spinner has been paused.');
        });
      });

      describe('when the spinner is paused', () => {
        it('should starts the spinner again', () => {
          expect.assertions(2);
          const spinner = new Spinner();
          spinner.start(spinnnerOptions);
          spinner.pause();
          spinner.continue();
          expect(spinner.isRunning()).toBe(true);
          expect(spinner.pausedSpinnerOptions).toBeNull();
          spinner.pause();
        });
      });
    });

    describe('when a spinner is running', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        expect(() => spinner.continue()).toThrow('A spinner is already running.');
        spinner.pause();
      });
    });
  });

  describe('when calling success', () => {
    const spinnnerOptions = { text: 'trying to success' };

    describe('when no spinner is running', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        expect(() => spinner.success()).toThrow('No spinner is running.');
      });
    });

    describe('when a spinner has been paused', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        spinner.pause();
        expect(() => spinner.success()).toThrow('No spinner is running.');
      });
    });

    describe('when a spinner is running', () => {
      it('should succesfully stop the spinner', () => {
        expect.assertions(4);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        const spy = jest.spyOn(spinner.spinnies, 'succeed');
        const spinnerUniqueKey = spinner.currentSpinnerUniqueKey;
        spinner.success();
        expect(spy).toHaveBeenCalledWith(spinnerUniqueKey, spinnnerOptions);
        expect(spinner.isRunning()).toBe(false);
        expect(spinner.currentSpinnerUniqueKey).toBeNull();
        expect(spinner.currentSpinnerOptions).toBeNull();
      });

      describe('when a custom success message is given', () => {
        it('should call success with the message', () => {
          expect.assertions(4);
          const spinner = new Spinner();
          spinner.start(spinnnerOptions);
          const spy = jest.spyOn(spinner.spinnies, 'succeed');
          const customOptions = { text: 'dummy' };
          const spinnerUniqueKey = spinner.currentSpinnerUniqueKey;
          spinner.success(customOptions);
          expect(spy).toHaveBeenCalledWith(spinnerUniqueKey, customOptions);
          expect(spinner.isRunning()).toBe(false);
          expect(spinner.currentSpinnerUniqueKey).toBeNull();
          expect(spinner.currentSpinnerOptions).toBeNull();
        });
      });
    });
  });

  describe('when calling fail', () => {
    const spinnnerOptions = { text: 'trying to fail' };

    describe('when no spinner is running', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        expect(() => spinner.fail()).toThrow('No spinner is running.');
      });
    });

    describe('when a spinner has been paused', () => {
      it('should throw an error', () => {
        expect.assertions(1);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        spinner.pause();
        expect(() => spinner.fail()).toThrow('No spinner is running.');
      });
    });

    describe('when a spinner is running', () => {
      it('should succesfully stop the spinner', () => {
        expect.assertions(4);
        const spinner = new Spinner();
        spinner.start(spinnnerOptions);
        const spy = jest.spyOn(spinner.spinnies, 'fail');
        const spinnerUniqueKey = spinner.currentSpinnerUniqueKey;
        spinner.fail();
        expect(spy).toHaveBeenCalledWith(spinnerUniqueKey, spinnnerOptions);
        expect(spinner.isRunning()).toBe(false);
        expect(spinner.currentSpinnerUniqueKey).toBeNull();
        expect(spinner.currentSpinnerOptions).toBeNull();
      });

      describe('when a custom fail message is given', () => {
        it('should call fail with the message', () => {
          expect.assertions(4);
          const spinner = new Spinner();
          spinner.start(spinnnerOptions);
          const spy = jest.spyOn(spinner.spinnies, 'fail');
          const customOptions = { text: 'dummy option text' };
          const spinnerUniqueKey = spinner.currentSpinnerUniqueKey;
          spinner.fail(customOptions);
          expect(spy).toHaveBeenCalledWith(spinnerUniqueKey, customOptions);
          expect(spinner.isRunning()).toBe(false);
          expect(spinner.currentSpinnerUniqueKey).toBeNull();
          expect(spinner.currentSpinnerOptions).toBeNull();
        });
      });
    });
  });
});
