const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  name: String,
  propArrayOfObjects: [{
    sampleValue: String,
    'complex name': String,
  }],
}, {
  timestamps: false,
});

module.exports = {
  collectionName: 'persons',
  modelName: 'persons',
  schema,
};
