const Spinner = require('./spinner-test');

let spinnerInstance = null;

const getSpinnerInstance = () => {
  if (!spinnerInstance) spinnerInstance = new Spinner();

  return spinnerInstance;
};

module.exports = getSpinnerInstance();
