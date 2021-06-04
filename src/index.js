const { init } = require('@forestadmin/context');
const makeDefaultPlan = require('./context/init');

init(makeDefaultPlan());

module.exports = require('@oclif/command');
