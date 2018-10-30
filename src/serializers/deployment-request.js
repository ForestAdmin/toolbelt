const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('deployment-requests', {
  attributes: ['from', 'to'],
  from: {
    ref: 'id',
    included: false,
  },
  to: {
    ref: 'id',
    included: false,
  },
  typeForAttribute: () => 'environments',
});
