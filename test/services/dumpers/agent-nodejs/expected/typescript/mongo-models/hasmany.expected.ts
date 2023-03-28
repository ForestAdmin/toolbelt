import Mongoose from 'mongoose';

interface FilmsInterface {
  actors: Array<Mongoose.Types.ObjectId>;
  author: Mongoose.Types.ObjectId;
  title: string;
}

const filmsSchema = new Mongoose.Schema({
  actors: { type: [Mongoose.Schema.Types.ObjectId], ref: 'persons' },
  author: { type: Mongoose.Schema.Types.ObjectId, ref: 'persons' },
  title: String,
}, {
  timestamps: false,
});

export { FilmsInterface, filmsSchema };
