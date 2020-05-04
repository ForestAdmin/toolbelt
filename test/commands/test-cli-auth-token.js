const fsExtra = require('fs-extra');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authenticator = require('./../../src/services/authenticator');

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
    fs.writeFileSync(`${getTokenPath()}/${fileName}`, token);
    return token;
  },
  getTokenPath,
  clearTokenPath,
  mockToken: (behavior) => {
    if (behavior !== null) {
      authenticator.getAuthTokenBack = authenticator.getAuthToken;
      authenticator.getAuthToken = () => behavior;
    }
    clearTokenPath();
  },
  rollbackToken: (behavior) => {
    if (behavior !== null) {
      authenticator.getAuthToken = authenticator.getAuthTokenBack;
      authenticator.getAuthTokenBack = null;
    }
  },
};
