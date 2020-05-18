const Spinnies = require('spinnies');
const logger = require('./logger');

const spinnies = new Spinnies({
  spinnerColor: 'yellow',
  spinner: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
});

module.exports = {
  add(key, options, promise = null) {
    spinnies.add(key, options);

    const spinner = {
      succeed(succeedOptions) {
        spinnies.succeed(key, succeedOptions);
      },
      fail(failOptions) {
        spinnies.fail(key, failOptions);
      },
      pause() {
        try {
          spinnies.remove(key);
          spinnies.stopAll();
        } catch (error) {
          console.log('pb here', error);
        }
      },
      continue() {
        spinnies.add(key, options);
      },
      executeAsync() {
        return spinner.promise;
      },
    };
    logger.spinner = spinner;

    if (promise) {
      spinner.promise = promise
        .then((result) => {
          logger.spinner = null;
          spinner.succeed();
          return result;
        })
        .catch((error) => {
          logger.spinner = null;
          spinner.fail();
          logger.error(error);
        });
    }

    return spinner;
  },
};
