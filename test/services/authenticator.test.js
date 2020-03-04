const { expect } = require('chai');
const fs = require('fs');
const jwt = require('jsonwebtoken');
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
    describe('when .forestrc and .lumberrc does not exists', () => {
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

    describe('when .lumberrc and .forestrc exists and are valid', () => {
      it('should return the .forestrc token', () => {
        const forestToken = storeToken('.forestrc', '1day');
        storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(tokenPath);
        expect(actualToken).to.equals(forestToken);
      });
    });
  });
});
