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
    // _id: false, Ambiguous usage of _ids, we could not detect if subDocuments use _id or not.
    sampleValue: String,
    'complex name': String,
  }],
}, {
  timestamps: false,
});

export { PersonsInterface, personsSchema };
