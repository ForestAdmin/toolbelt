const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  cousin: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  dad: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  name: String,
  preferredFilm: { type: Mongoose.Schema.Types.ObjectId, ref: 'films' },
  son: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
}, {
  timestamps: false,
});

module.exports = {
  collectionName: 'persons',
  modelName: 'persons',
  schema,
};
