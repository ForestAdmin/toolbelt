const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('environments', {
    attributes: [
      'name',
      'defaultEnvironment',
    ],
    defaultEnvironment: {
      ref: 'id',
      attributes: ['name', 'apiEndpoint', 'type'],
    },
});
