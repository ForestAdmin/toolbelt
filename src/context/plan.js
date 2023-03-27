/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addPackage('dependencies', require('./dependencies-plan'))
    .addPackage('env', require('./env-plan'))
    .addPackage('process', require('./process-plan'))
    .addPackage('utils', require('./utils-plan'))
    .addPackage('serializers', require('./serializers-plan'))
    .addPackage('services', require('./services-plan'))
    .addPackage('renderers', require('./renderers-plan'))
    .addPackage('commandProjectCommon', require('./command-projects-common-plan'))
    .addPackage('commandProjectCreate', require('./command-project-create-plan'))
    .addPackage('commandProjectUpdate', require('./command-schema-update-command-plan'));
