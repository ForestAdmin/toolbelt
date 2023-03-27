const Mongoose = require('mongoose');

const schema = new Mongoose.Schema({
  'name': String,
  'very': {
    'deep': {
      'model': {
        'arrayOfNumber': [Number],
        'arrayMixed': [Object],
        'arrayOfObjectIds': [Mongoose.Schema.Types.ObjectId],
        'arrayWithComplexObject': [{
          'name': String,
          'propGroup': {
            'answer': Boolean,
            'date': Date,
            'sentence': String,
            'number': Number,
          },
        }],
        'arrayOfComplexObjects': [{
          'propGroup': {
            'answer': Boolean,
            'date': Date,
            'sentence': String,
            'number': Number,
          },
          'so': {
            'nested': {
              'arrayMixed': [Object],
              'arrayOfNumber': [Number],
            },
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
