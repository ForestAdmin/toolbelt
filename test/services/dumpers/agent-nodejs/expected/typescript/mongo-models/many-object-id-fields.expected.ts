import Mongoose from 'mongoose';

interface PersonsInterface {
  cousin: Mongoose.Types.ObjectId;
  dad: Mongoose.Types.ObjectId;
  name: string;
  preferredFilm: Mongoose.Types.ObjectId;
  son: Mongoose.Types.ObjectId;
}

const personsSchema = new Mongoose.Schema({
  cousin: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  dad: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  name: String,
  preferredFilm: { type: Mongoose.Schema.Types.ObjectId, ref: 'films' },
  son: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
}, {
  timestamps: false,
});

export { PersonsInterface, personsSchema };
