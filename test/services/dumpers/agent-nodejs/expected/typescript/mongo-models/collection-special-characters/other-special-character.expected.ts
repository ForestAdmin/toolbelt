import Mongoose from 'mongoose';

interface OtherSpecialCharacterInterface {
  age: number;
}

const otherSpecialCharacterSchema = new Mongoose.Schema({
  age: Number,
}, {
  timestamps: false,
});

export { OtherSpecialCharacterInterface, otherSpecialCharacterSchema };
