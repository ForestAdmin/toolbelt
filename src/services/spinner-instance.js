const Spinner = require('./spinner');

let spinnerInstance = null;

/**
 * This singleton spinner instance is intended to be used as follow:
 * @example
 * const spinner = require('path/to/spinner-instance')
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
 * @returns {Spinner} Returns the existing spinner instance or creates a new one.
 */
const getSpinnerInstance = () => {
  if (!spinnerInstance) spinnerInstance = new Spinner();

  return spinnerInstance;
};

// NOTICE: usage: `const spinner = require('path/to/spinner-instance')`
module.exports = getSpinnerInstance();
