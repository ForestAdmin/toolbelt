require('dotenv').config();

module.exports = {
  serverHost: () => process.env.FOREST_URL || 'https://api.forestadmin.com',
};
