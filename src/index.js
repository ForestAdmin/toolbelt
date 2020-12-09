const context = require('./context');
const initContext = require('./context/init');

initContext(context);

module.exports = require('@oclif/command');
