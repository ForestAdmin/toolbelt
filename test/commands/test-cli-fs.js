const path = require('path');
const fsExtra = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const TMP_DIRECTORY_BASE = '/tmp/toolbelt-tests';

module.exports = {
  randomDirectoryName: () => `${TMP_DIRECTORY_BASE}/${uuidv4()}`,

  makeTempDirectory: (dirPath) => fsExtra.ensureDirSync(dirPath),

  mockFile: (file = {}) => {
    const {
      chdir,
      content,
      directory,
      name,
    } = file;
    let filePath = directory || name;

    if (filePath) {
      if (chdir) filePath = path.join(chdir, filePath);
      if (name) fsExtra.outputFileSync(name, content);
      else fsExtra.ensureDirSync(filePath);
    }
  },

  cleanMockedFile: (file = {}) => {
    const { chdir, directory, name } = file;
    let filePath = directory || name;

    if (chdir) filePath = path.join(chdir, filePath);
    fsExtra.removeSync(filePath);
  },
};
