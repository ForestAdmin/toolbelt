const DEFAULT_FOREST_URL = 'https://api.forestadmin.com';

module.exports = (plan) => plan
  .addValue('constants', {
    DEFAULT_FOREST_URL,
  });
