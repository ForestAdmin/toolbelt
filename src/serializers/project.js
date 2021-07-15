const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('projects', {
  attributes: [
    'name',
    'defaultEnvironment',
    'origin',
  ],
  defaultEnvironment: {
    ref: 'id',
    attributes: ['name', 'apiEndpoint', 'type'],
  },
});
