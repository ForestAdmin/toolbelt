/* eslint-disable global-require */
module.exports = (plan) => plan
  .addInstance('applicationTokenSerializer', () => require('../serializers/application-token'))
  .addInstance('applicationTokenDeserializer', () => require('../deserializers/application-token'))
  .addInstance('environmentDeserializer', () => require('../deserializers/environment'))
  .addInstance('environmentSerializer', () => require('../serializers/environment'))
  .addInstance('projectDeserializer', () => require('../deserializers/project'))
  .addInstance('projectSerializer', () => require('../serializers/project'));
