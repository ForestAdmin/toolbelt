const fsExtra = require('fs-extra');
const jwt = require('jsonwebtoken');

const fakeKey = 'test-token-key';

const getTokenPath = () => process.env.TOKEN_PATH || process.cwd();

const clearTokenPath = ({ env }) => {
  fsExtra.removeSync(env.TOKEN_PATH);
  fsExtra.mkdirsSync(env.TOKEN_PATH);
  fsExtra.emptyDirSync(env.TOKEN_PATH);
};

module.exports = {
  storeToken: (fileName, expiresIn = '14 days') => {
    const token = jwt.sign({}, fakeKey, { expiresIn });
    fsExtra.outputFileSync(`${getTokenPath()}/${fileName}`, token);
    return token;
  },
  getTokenPath,
  clearTokenPath,
};