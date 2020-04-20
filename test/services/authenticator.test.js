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

describe('authenticator', () => {
  describe('getAuthToken', () => {
    function prepareTest() {
      fsExtra.removeSync(tokenPath);
      fsExtra.mkdirsSync(tokenPath);
      fsExtra.emptyDirSync(tokenPath);
    }

    describe('when .forestrc and .lumberrc do not exist', () => {
      it('should return null', () => {
        expect.assertions(1);
        prepareTest();
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken('.');
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc exists and is valid', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        prepareTest();
        const expectedToken = storeToken('.lumberrc');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc exists and is expired', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        prepareTest();
        storeToken('.lumberrc', '0ms');
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and are valid', () => {
      it('should return the .forestrc token', () => {
        expect.assertions(1);
        prepareTest();
        const forestToken = storeToken('.forestrc', '1day');
        storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).toStrictEqual(forestToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .forestrc is invalid', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        prepareTest();
        storeToken('.forestrc', '0ms');
        const lumberToken = storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).toStrictEqual(lumberToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .lumberrc is invalid', () => {
      it('should return the .forestrc token', () => {
        expect.assertions(1);
        prepareTest();
        const forestToken = storeToken('.forestrc', '2days');
        storeToken('.lumberrc', '0ms');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).toStrictEqual(forestToken);
      });
    });
  });
});
