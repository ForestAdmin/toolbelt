const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('projects', {
  attributes: [
    'name',
    'defaultEnvironment',
    'origin',
    'agent',
    'databaseType',
    'architecture',
    'invitationClaim',
  ],
  defaultEnvironment: {
    ref: 'id',
    attributes: ['name', 'apiEndpoint', 'type'],
  },
  keyForAttribute: 'snake_case',
});
