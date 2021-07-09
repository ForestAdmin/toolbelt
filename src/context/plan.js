const processPlan = require('./process-plan');
const envPlan = require('./env-plan');
const dependenciesPlan = require('./dependencies-plan');
const utilsPlan = require('./utils-plan');
const renderersPlan = require('./renderers-plan');
const serializersPlan = require('./serializers-plan');
const servicesPlan = require('./services-plan');
const commandProjectCommonPlan = require('./command-projects-common-plan');
const commandProjectCreatePlan = require('./command-project-create-plan');
const commandSchemaUpdatePlan = require('./command-schema-update-command-plan');

require('../config');

module.exports = (plan) => plan
  .addStep('dependencies', dependenciesPlan)
  .addStep('process', processPlan)
  .addStep('env', envPlan)
  .addStep('utils', utilsPlan)
  .addStep('serializers', serializersPlan)
  .addStep('services', servicesPlan)
  .addStep('renderers', renderersPlan)
  .addStep('commandProjectCommon', commandProjectCommonPlan)
  .addStep('commandProjectCreate', commandProjectCreatePlan)
  .addStep('commandProjectUpdate', commandSchemaUpdatePlan);
