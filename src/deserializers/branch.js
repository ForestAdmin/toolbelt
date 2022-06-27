const JSONAPIDeserializer = require('jsonapi-serializer').Deserializer;

module.exports = new JSONAPIDeserializer({
  keyForAttribute: 'camelCase',
  environments: {
    valueForRelationship: (relationship) => ({ id: relationship.id }),
  },
});
