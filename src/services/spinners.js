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
    };
    logger.spinner = spinner;

    if (promise) {
      promise
        .then((result) => {
          logger.spinner = null;
          spinner.succeed();
          return result;
        })
        .catch(() => {
          logger.spinner = null;
          spinner.fail();
        });
    }

    return spinner;
  },
};
