const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('branch', {
  attributes: ['id', 'name'],
});
