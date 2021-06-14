const { init } = require('@forestadmin/context');
const makeDefaultPlan = require('./context/plan');

init(makeDefaultPlan());

module.exports = require('@oclif/command');
