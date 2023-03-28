import type { FilmsInterface } from './films';
import type { PersonsInterface } from './persons';

import * as Mongoose from 'mongoose';

import { filmsSchema } from './films';
import { personsSchema } from './persons';

const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
const connection = Mongoose.createConnection(process.env.DATABASE_URL, connectionOptions);

export const films = connection.model<FilmsInterface>('films', filmsSchema, 'films');
export const persons = connection.model<PersonsInterface>('persons', personsSchema, 'persons');

export default connection;
