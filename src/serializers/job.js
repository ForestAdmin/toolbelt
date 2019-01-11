const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('jobs', {
  attributes: ['state', 'progress'],
});
