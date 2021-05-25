const fsExtra = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ApplicationContext = require('../../src/context/application-context');
const { clearTokenPath, getTokenPath, storeToken } = require('../commands/test-cli-auth-token');
const initContext = require('../../src/context/init');

const context = new ApplicationContext();
initContext(context);
const { authenticator } = context.inject();

const TMP_DIRECTORY_ROOT = '/tmp/toolbelt-tests';
const TMP_DIRECTORY_BASE = `${TMP_DIRECTORY_ROOT}/authenticator`;

describe('authenticator', () => {
  // NOTICE: Ensure each test proerly runs in a separate unique directory.
  // eslint-disable-next-line jest/no-hooks
  beforeEach(async () => {
    const temporaryDirectory = `${TMP_DIRECTORY_BASE}/${uuidv4()}`;
    fsExtra.mkdirsSync(temporaryDirectory);
    process.chdir(temporaryDirectory);
  });

  // NOTICE: Properly cleanup temporary directories.
  // eslint-disable-next-line jest/no-hooks
  afterAll(async () => {
    process.chdir(TMP_DIRECTORY_ROOT);
    fsExtra.removeSync(TMP_DIRECTORY_BASE);
  });

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
