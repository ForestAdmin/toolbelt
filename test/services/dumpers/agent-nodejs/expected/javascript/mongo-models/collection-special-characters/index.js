const fs = require('fs');
const path = require('path');
const Mongoose = require('mongoose');

const connection = Mongoose.createConnection(process.env.DATABASE_URL);

fs
  .readdirSync(__dirname)
  .filter((file) => file !== 'index.js')
  .forEach((file) => {
    try {
      const { schema, modelName, collectionName } = require(path.join(__dirname, file));
      connection.model(modelName, schema, collectionName);
    } catch (error) {
      console.error(`Model creation error: ${error}`);
    }
  });

module.exports = connection;
