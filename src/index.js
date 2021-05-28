const { init } = require('@forestadmin/context');
const plan = require('./context/init');

init(plan);

module.exports = require('@oclif/command');
