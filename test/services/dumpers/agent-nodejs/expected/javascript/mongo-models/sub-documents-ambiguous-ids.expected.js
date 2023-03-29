const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  name: String,
  propArrayOfObjects: [{
    // _id: false, Ambiguous usage of _ids, we could not detect if subDocuments use _id or not.
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
