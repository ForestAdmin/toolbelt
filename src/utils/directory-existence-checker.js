const fs = require('fs');
const path = require('path');

function DirectoryExistenceChecker(directory, basePath = undefined) {
  this.perform = () => {
    let directoryToCheck = directory;
    if (basePath) directoryToCheck = path.resolve(basePath, directory);
    try {
      fs.accessSync(directoryToCheck, fs.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  };
}

module.exports = DirectoryExistenceChecker;
