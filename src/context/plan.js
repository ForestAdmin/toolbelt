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

module.exports = (plan) => plan
  .addStep('dependencies', dependenciesPlan)
  .addStep('env', envPlan)
  .addStep('process', processPlan)
  .addStep('utils', utilsPlan)
  .addStep('serializers', serializersPlan)
  .addStep('services', servicesPlan)
  .addStep('renderers', renderersPlan)
  .addStep('commandProjectCommon', commandProjectCommonPlan)
  .addStep('commandProjectCreate', commandProjectCreatePlan)
  .addStep('commandProjectUpdate', commandSchemaUpdatePlan);
