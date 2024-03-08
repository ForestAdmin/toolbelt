const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  very: {
    deep: {
      model: {
        arrayOfNumber: [Number],
        arrayMixed: [Object],
        arrayOfObjectIds: [Mongoose.Schema.Types.ObjectId],
        arrayWithComplexObject: [{
          name: String,
          propGroup: {
            date: Date,
            sentence: String,
            number: Number,
          },
        }],
        arrayOfComplexObjects: [{
          propGroup: {
            answer: Boolean,
            date: Date,
            sentence: String,
            number: Number,
          },
        }],
      },
    },
  },
}, {
  timestamps: false,
});

module.exports = {
  collectionName: 'persons',
  modelName: 'persons',
  schema,
};
