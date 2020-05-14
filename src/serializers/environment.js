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
    'secretKey',
    'currentBranchName',
  ],
  project: {
    ref: 'id',
    included: false,
  },
});
