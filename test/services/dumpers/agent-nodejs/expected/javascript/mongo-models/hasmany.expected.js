const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  actors: { type: [Mongoose.Schema.Types.ObjectId], ref: 'persons' },
  author: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  title: String,
}, {
  timestamps: false,
});

module.exports = {
  collectionName: 'films',
  modelName: 'films',
  schema,
};
