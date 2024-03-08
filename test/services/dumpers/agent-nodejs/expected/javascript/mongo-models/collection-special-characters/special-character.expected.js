const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  name: String,
}, {
  timestamps: false,
});

module.exports = {
  collectionName: '_special:character',
  modelName: 'specialCharacter',
  schema,
};
