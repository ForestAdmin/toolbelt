const Spinnies = require('spinnies');

const DEFAULT_SPINNER_NAME = 'default-spinner';

class Spinner {
  constructor() {
    this.spinnies = new Spinnies({
      spinnerColor: 'yellow',
      spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        succeedPrefix: '✅',
        failPrefix: '❌',
      },
    });
    this.currentSpinnerOptions = null;
  }

  start(options) {
    if (this.spinnies.hasActiveSpinners()) {
      throw Error('A spinner is already running.');
    }

    this.currentSpinnerOptions = options;
    this.spinnies.add(DEFAULT_SPINNER_NAME, options);
  }

  stop() {
    if (!this.spinnies.hasActiveSpinners()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.stopAll();
    this.currentSpinnerOptions = null;
  }

  success() {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.succeed(DEFAULT_SPINNER_NAME, this.currentSpinnerOptions);
    this.currentSpinnerOptions = null;
  }

  fail(options) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.fail(DEFAULT_SPINNER_NAME, options);
    this.currentSpinnerOptions = null;
  }

  pause() {
    if (this.isRunning()) {
      this.spinnies.stopAll();
    }
  }

  continue() {
    if (!this.isRunning()) {
      this.spinnies.add(DEFAULT_SPINNER_NAME, this.currentSpinnerOptions);
    }
  }

  isRunning() {
    return this.spinnies.hasActiveSpinners();
  }

  runOnPromise(options, promise) {
    this.start(options);

    return promise
      .then((result) => {
        this.success(options);
        return result;
      })
      .catch((error) => {
        this.fail({ text: error });
      });
  }
}

module.exports = Spinner;
