const { expect } = require('chai');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fsExtra = require('fs-extra');
const authenticator = require('../../src/services/authenticator');

const key = 'test-token-key';
const tokenPath = './test/services/tokens';
const storeToken = (fileName, expiresIn = '14 days') => {
  const token = jwt.sign({}, key, { expiresIn });
  fs.writeFileSync(`${tokenPath}/${fileName}`, token);
  return token;
};

describe('Authenticator', () => {
  describe('getAuthToken', () => {
    beforeEach(() => {
      fsExtra.mkdirsSync(tokenPath);
      fsExtra.emptyDirSync(tokenPath);
    });

    afterEach(() => {
      fsExtra.removeSync(tokenPath)
    });

    describe('when .forestrc and .lumberrc do not exist', () => {
      it('should return null', () => {
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken('.');
        expect(actualToken).to.equals(expectedToken);
      });
    });

    describe('when .lumberrc exists and is valid', () => {
      it('should return the .lumberrc token', () => {
        const expectedToken = storeToken('.lumberrc');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(expectedToken);
      });
    });

    describe('when .lumberrc exists and is expired', () => {
      it('should return the .lumberrc token', () => {
        storeToken('.lumberrc', '0ms');
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(expectedToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and are valid', () => {
      it('should return the .forestrc token', () => {
        const forestToken = storeToken('.forestrc', '1day');
        storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(forestToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .forestrc is invalid', () => {
      it('should return the .lumberrc token', () => {
        storeToken('.forestrc', '0ms');
        const lumberToken = storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(lumberToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .lumberrc is invalid', () => {
      it('should return the .forestrc token', () => {
        const forestToken = storeToken('.forestrc', '2days');
        storeToken('.lumberrc', '0ms');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(forestToken);
      });
    });
  });
});
