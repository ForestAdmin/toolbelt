const constantsPlan = require('./constants-plan');
const envPlan = require('./env-plan');
const dependenciesPlan = require('./dependancies-plan');
const utilsPlan = require('./utils-plan');
const serializersPlan = require('./serializers-plan');
const servicesPlan = require('./services-plan');
const commandProjectCreatePlan = require('./command-project-create-plan');
const commandSchemaUpdatePlan = require('./command-schema-update-command-plan');

require('../config');

module.exports = (plan) => plan
  .addStep('constants', constantsPlan)
  .addStep('env', envPlan)
  .addStep('dependencies', dependenciesPlan)
  .addStep('utils', utilsPlan)
  .addStep('serializers', serializersPlan)
  .addStep('services', servicesPlan)
  .addStep('commandProjectCreate', commandProjectCreatePlan)
  .addStep('commandProjectUpdate', commandSchemaUpdatePlan);
