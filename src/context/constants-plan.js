const DEFAULT_FOREST_URL = 'https://api.forestadmin.com';

module.exports = (plan) => plan
  .addInstance('constants', {
    DEFAULT_FOREST_URL,
  });
