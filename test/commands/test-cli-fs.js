const fs = require('fs');

module.exports = {
  mockFile: (file = {}) => {
    const { chdir, name, content } = file;
    if (chdir) {
      fs.mkdirSync(chdir, { recursive: true });
      process.chdir(chdir);
    }
    if (name) fs.writeFileSync(name, content);
  },

  cleanMockedFile: (file = {}) => {
    const { chdir, name } = file;
    if (chdir) process.chdir(chdir);
    if (name) fs.unlinkSync(name);
  },
};
