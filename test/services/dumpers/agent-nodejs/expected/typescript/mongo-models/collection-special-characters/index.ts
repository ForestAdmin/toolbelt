import type { OtherSpecialCharacterInterface } from './other-special-character';
import type { SpecialCharacterInterface } from './special-character';

import Mongoose from 'mongoose';

import { otherSpecialCharacterSchema } from './other-special-character';
import { specialCharacterSchema } from './special-character';

const connection = Mongoose.createConnection(process.env.DATABASE_URL);

export const otherSpecialCharacter = connection.model<OtherSpecialCharacterInterface>('otherSpecialCharacter', otherSpecialCharacterSchema, ':otherSpecial*character');
export const specialCharacter = connection.model<SpecialCharacterInterface>('specialCharacter', specialCharacterSchema, '_special:character');

export default connection;
