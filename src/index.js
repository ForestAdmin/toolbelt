const { init } = require('@forestadmin/context');
const initContext = require('./context/init');

init(initContext);

module.exports = require('@oclif/command');
