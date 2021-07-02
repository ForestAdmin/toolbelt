const Context = require('@forestadmin/context');

const staticPlan = require('./context/static-plan');

// NOTICE: Needed to allow use of injected modules in command flag creation.
//         Check schema:update for exemple.
Context.init(staticPlan);

module.exports = require('@oclif/command');
