const JSONAPISerializer = require('jsonapi-serializer').Serializer;

module.exports = new JSONAPISerializer('environments', {
  attributes: [
    'name',
    'apiEndpoint',
    'project',
    'isActive',
    'type',
    'lianaName',
    'lianaVersion',
    'project',
    'secretKey',
    'currentBranchId',
  ],
  project: {
    ref: 'id',
    included: false,
  },
});
