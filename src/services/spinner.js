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
    if (this.isRunning()) {
      throw Error('A spinner is already running.');
    }

    this.currentSpinnerOptions = options;
    this.spinnies.add(DEFAULT_SPINNER_NAME, options);
  }

  stop() {
    if (!this.isRunning()) {
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
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.stopAll();
    this.pausedSpinnerOptions = this.currentSpinnerOptions;
  }

  continue() {
    if (this.isRunning()) {
      throw Error('A spinner is already running.');
    }

    if (!this.pausedSpinnerOptions) {
      throw Error('No spinner has been paused.');
    }

    this.spinnies.add(DEFAULT_SPINNER_NAME, this.pausedSpinnerOptions);
    this.pausedSpinnerOptions = null;
  }

  isRunning() {
    return this.spinnies.hasActiveSpinners();
  }

  // NOTICE: spinner.start needs to be called first
  attachToPromise(promise) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    return promise
      .then((result) => {
        this.success(this.currentSpinnerOptions);
        return result;
      })
      .catch((error) => {
        this.fail({ text: error });
        throw error;
      });
  }
}

module.exports = Spinner;
