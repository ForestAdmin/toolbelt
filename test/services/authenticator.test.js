const authenticator = require('../../src/services/authenticator');
const { clearTokenPath, getTokenPath, storeToken } = require('../commands/test-cli-auth-token');

describe('authenticator', () => {
  describe('getAuthToken', () => {
    describe('when .forestrc and .lumberrc do not exist', () => {
      it('should return null', () => {
        expect.assertions(1);
        clearTokenPath();
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc exists and is valid', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        clearTokenPath();
        const expectedToken = storeToken('.lumberrc');
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc exists and is expired', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        clearTokenPath();
        storeToken('.lumberrc', '0ms');
        const expectedToken = null;
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(expectedToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and are valid', () => {
      it('should return the .forestrc token', () => {
        expect.assertions(1);
        clearTokenPath();
        const forestToken = storeToken('.forestrc', '1day');
        storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(forestToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .forestrc is invalid', () => {
      it('should return the .lumberrc token', () => {
        expect.assertions(1);
        clearTokenPath();
        storeToken('.forestrc', '0ms');
        const lumberToken = storeToken('.lumberrc', '2days');
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(lumberToken);
      });
    });

    describe('when .lumberrc and .forestrc exist and .lumberrc is invalid', () => {
      it('should return the .forestrc token', () => {
        expect.assertions(1);
        clearTokenPath();
        const forestToken = storeToken('.forestrc', '2days');
        storeToken('.lumberrc', '0ms');
        const actualToken = authenticator.getAuthToken(getTokenPath());
        expect(actualToken).toStrictEqual(forestToken);
      });
    });
  });
});
