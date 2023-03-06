const fs = require('fs');
const path = require('path');
const Mongoose = require('mongoose');

const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
const connection = Mongoose.createConnection(process.env.DATABASE_URL, connectionOptions);

fs
  .readdirSync(__dirname)
  .filter((file) => file !== 'index.js')
  .forEach((file) => {
    try {
      const { schema, model, tableName } = require(path.join(modelsDirectory, file));
      connection.model(model, schema, tableName);
    } catch (error) {
      console.error(`Model creation error: ${error}`);
    }
  });

module.exports = connection;
