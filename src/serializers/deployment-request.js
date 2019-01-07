const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('deployment-requests', {
  attributes: ['type', 'from', 'to'],
  typeForAttribute: () => 'deployment-requests',
});
