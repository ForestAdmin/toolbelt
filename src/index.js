const { init } = require('@forestadmin/context');
const defaultPlan = require('./context/plan');

init(defaultPlan);

module.exports = require('@oclif/command');
