const fs = require('fs');

const TMP_DIRECTORY_BASE = '/tmp/toolbelt-tests';

module.exports = {
  TMP_DIRECTORY_BASE,

  mockFile: (file = {}) => {
    const { chdir, name, content } = file;
    if (chdir) {
      fs.mkdirSync(chdir, { recursive: true });
      process.chdir(chdir);
    }
    if (name) fs.writeFileSync(name, content);
  },

  cleanMockedFile: (file = {}) => {
    const { chdir, name, temporaryDirectory } = file;
    if (chdir) process.chdir(chdir);
    if (name) fs.unlinkSync(name);
    if (temporaryDirectory) {
      process.chdir(TMP_DIRECTORY_BASE);
      fs.rmdirSync(chdir, { recursive: true });
    }
  },
};
