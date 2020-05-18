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
// NOTICE: Singleton used here to attach all generated spinner to the same spinnies instance.
const spinniesInstance = singletonGetter(Spinnies, spinniesConstructorParameters);

// NOTICE: Except if you need several spinner running at the same time,
//         a `singleton-getter` usage should be prefered.
/**
 * A single instance of spinner is intended to be used as follow:
 * @example
 * const singletonGetter = require('path/to/singleton-getter')
 * const spinner = singletonGetter(Spinner)
 *
 * // synchronously:
 * spinner.start({ text: 'my super text' })
 * // do something
 * spinner.success()
 *
 * // on promise:
 * spinner.start({ text: 'my super text' })
 * spinner.attachToPromise(mySuperPromise())
 *
 * If ever multiple instances are need to be run together:
 * @example
 * const Spinner = require('./spinner');
 *
 * const spinner1 = new Spinner();
 * const spinner2 = new Spinner();
 */
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

  // NOTICE: optional parameter options to have a custom success message
  success(options = this.currentSpinnerOptions) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.succeed(this.currentSpinnerUniqueKey, options);
    this.stop();
  }

  // NOTICE: optional parameter options to have a custom fail message
  fail(options = this.currentSpinnerOptions) {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.fail(this.currentSpinnerUniqueKey, options);
    this.stop();
  }

  async pause() {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    await this.spinnies.remove(this.currentSpinnerUniqueKey);
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
    return !!this.spinnies.pick(this.currentSpinnerUniqueKey);
  }

  // NOTICE: spinner.start needs to be called first
  attachToPromise(promise) {
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
