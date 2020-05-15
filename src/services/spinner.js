const { v4: uuidv4 } = require('uuid');
const Spinnies = require('spinnies');
const singletonGetter = require('./singleton-getter');

const spinniesConstructorParameters = {
  spinnerColor: 'yellow',
  spinner: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
};
const spinniesInstance = singletonGetter(Spinnies, spinniesConstructorParameters);

// NOTICE: Except if you need several spinner runnign at the same time,
//         a `singleton-getter` usage should be prefered.
class Spinner {
  constructor() {
    this.spinnies = spinniesInstance;
    this.currentSpinnerOptions = null;
  }

  start(options) {
    if (this.isRunning()) {
      throw Error('A spinner is already running.');
    }

    this.currentSpinnerOptions = options;
    this.currentSpinnerUniqueKey = uuidv4();
    this.spinnies.add(this.currentSpinnerUniqueKey, options);
  }

  // NOTICE: optionnal parameter options to have a custom success message
  success(options = this.currentSpinnerOptions) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.succeed(this.currentSpinnerUniqueKey, options);
    this.stop();
  }

  fail(options) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.fail(this.currentSpinnerUniqueKey, options);
    this.stop();
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

    this.spinnies.add(this.currentSpinnerUniqueKey, this.pausedSpinnerOptions);
    this.pausedSpinnerOptions = null;
  }

  isRunning() {
    return !!this.currentSpinnerUniqueKey;
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

  // NOTICE: this stop method should only be used internally to reset the current spinner
  //         on success or failure.
  stop() {
    this.currentSpinnerUniqueKey = null;
    this.currentSpinnerOptions = null;
  }
}

module.exports = Spinner;
