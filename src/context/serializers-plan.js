const applicationTokenSerializer = require('../serializers/application-token');
const applicationTokenDeserializer = require('../deserializers/application-token');
const environmentDeserializer = require('../deserializers/environment');
const environmentSerializer = require('../serializers/environment');
const projectDeserializer = require('../deserializers/project');
const projectSerializer = require('../serializers/project');

module.exports = (plan) => plan
  .addInstance('applicationTokenSerializer', applicationTokenSerializer)
  .addInstance('applicationTokenDeserializer', applicationTokenDeserializer)
  .addInstance('environmentDeserializer', environmentDeserializer)
  .addInstance('environmentSerializer', environmentSerializer)
  .addInstance('projectDeserializer', projectDeserializer)
  .addInstance('projectSerializer', projectSerializer);
