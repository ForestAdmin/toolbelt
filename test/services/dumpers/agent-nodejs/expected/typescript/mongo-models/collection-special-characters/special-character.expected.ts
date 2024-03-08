import Mongoose from 'mongoose';

interface SpecialCharacterInterface {
  name: string;
}

const specialCharacterSchema = new Mongoose.Schema({
  name: String,
}, {
  timestamps: false,
});

export { SpecialCharacterInterface, specialCharacterSchema };
