const fsExtra = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const TMP_DIRECTORY_BASE = '/tmp/toolbelt-tests';

module.exports = {
  randomDirectoryName: () => `${TMP_DIRECTORY_BASE}/${uuidv4()}`,

  mockFile: (file = {}) => {
    const { chdir, name, content } = file;
    if (chdir) {
      fsExtra.mkdirsSync(chdir);
      process.chdir(chdir);
    }
    if (name) fsExtra.outputFileSync(name, content);
  },

  cleanMockedFile: (file = {}) => {
    const { chdir, name, temporaryDirectory } = file;
    if (chdir) process.chdir(chdir);
    if (name) fsExtra.removeSync(name);
    if (temporaryDirectory) {
      process.chdir(TMP_DIRECTORY_BASE);
      fsExtra.removeSync(chdir);
    }
  },
};
