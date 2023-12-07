const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  age: Number,
}, {
  timestamps: false,
});

module.exports = {
  collectionName: ':otherSpecial*character',
  modelName: 'otherSpecialCharacter',
  schema,
};
