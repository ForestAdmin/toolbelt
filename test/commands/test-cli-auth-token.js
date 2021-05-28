const fsExtra = require('fs-extra');
const jwt = require('jsonwebtoken');

const getTokenPath = () => process.env.TOKEN_PATH || './test/services/tokens';
const fakeKey = 'test-token-key';
const clearTokenPath = () => {
  fsExtra.removeSync(getTokenPath());
  fsExtra.mkdirsSync(getTokenPath());
  fsExtra.emptyDirSync(getTokenPath());
};

module.exports = {
  storeToken: (fileName, expiresIn = '14 days') => {
    const token = jwt.sign({}, fakeKey, { expiresIn });
    fsExtra.outputFileSync(`${getTokenPath()}/${fileName}`, token);
    return token;
  },
  getTokenPath,
  clearTokenPath,
  mockToken: (behavior, { authenticator }) => {
    if (behavior !== null) {
      authenticator.getAuthTokenBack = authenticator.getAuthToken;
      authenticator.getAuthToken = () => behavior;
    }
    clearTokenPath();
  },
  rollbackToken: (behavior, { authenticator }) => {
    if (behavior !== null) {
      authenticator.getAuthToken = authenticator.getAuthTokenBack;
      authenticator.getAuthTokenBack = null;
    }
  },
};
