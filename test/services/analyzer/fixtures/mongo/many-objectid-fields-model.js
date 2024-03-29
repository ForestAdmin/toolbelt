const { ObjectID } = require('mongodb');

const persons = [
  {
    _id: ObjectID(),
    name: 'James Cameron',
  },
  {
    _id: ObjectID(),
    name: 'Big Cameron',
  },
  {
    _id: ObjectID(),
    name: 'Brad Pitt',
  },
];

const films = [
  {
    _id: ObjectID(),
    title: 'Terminator',
    author: persons.find(person => person.name === 'James Cameron')._id,
  },
  {
    _id: ObjectID(),
    title: 'Fight Club',
    bestActor: persons.find(person => person.name === 'Brad Pitt')._id,
  },
];

persons[0].dad = persons[1]._id;
persons[1].son = persons[0]._id;
persons[2].cousin = persons[0]._id;
persons[2].cousin = persons[1]._id;
persons[2].preferredFilm = films[1]._id;
persons[1].preferredFilm = null;

module.exports = { films, persons };
