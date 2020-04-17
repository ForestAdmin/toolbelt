const fs = require('fs');

module.exports = {
  mockFile: (file = {}) => {
    const { chdir, name, content } = file;
    if (chdir) process.chdir(chdir);
    if (name) fs.writeFileSync(name, content);
  },
};
