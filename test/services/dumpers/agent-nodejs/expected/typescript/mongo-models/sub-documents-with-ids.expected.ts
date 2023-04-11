import Mongoose from 'mongoose';

interface PersonsInterface {
  name: string;
  propArrayOfObjects: Array<{
    _id: Mongoose.Types.ObjectId;
    sampleValue: string;
    'complex name': string;
  }>;
}

const personsSchema = new Mongoose.Schema({
  name: String,
  propArrayOfObjects: [{
    sampleValue: String,
    'complex name': String,
  }],
}, {
  timestamps: false,
});

export { PersonsInterface, personsSchema };
