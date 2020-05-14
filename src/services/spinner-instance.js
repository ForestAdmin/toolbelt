const Spinner = require('./spinner');

let spinnerInstance = null;

const getSpinnerInstance = () => {
  if (!spinnerInstance) spinnerInstance = new Spinner();

  return spinnerInstance;
};

module.exports = getSpinnerInstance();
