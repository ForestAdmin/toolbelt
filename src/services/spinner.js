const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const Spinnies = require('spinnies');

const spinniesConstructorParameters = {
  color: 'yellow',
  failPrefix: `${chalk.bold.red('×')}`,
  spinnerColor: 'yellow',
  spinner: {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
  succeedPrefix: `${chalk.bold.green('✓')}`,
};
// NOTICE: Singleton used here to attach all generated spinner to the same spinnies instance.
const spinniesInstance = new Spinnies(spinniesConstructorParameters);

/**
 * A single instance of spinner is intended to be used as follow:
 * @example
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

  pause() {
    if (!this.isRunning()) {
      throw Error('No spinner is running.');
    }

    this.spinnies.remove(this.currentSpinnerUniqueKey);
    // NOTICE: spinnies lib function that checks for active spinners and if none, release cli usage
    this.spinnies.checkIfActiveSpinners();
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
        // NOTICE: Only trigger the fail if the spinner is running (ie. not paused)
        if (this.isRunning()) {
          this.fail({ text: error });
        }
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
