const { ObjectID } = require('mongodb');

const persons = [
  {
    _id: ObjectID(),
    name: 'James Cameron',
  },
];

const actors = [
  {
    _id: ObjectID(),
    name: 'Jim Carrey',
  },
];

const films = [
  {
    _id: ObjectID(),
    title: 'Terminator',
    author: persons.find(person => person.name === 'James Cameron')._id,
    refersTo: 'persons',
  },
  {
    _id: ObjectID(),
    title: 'The mask',
    author: actors.find(actor => actor.name === 'Jim Carrey')._id,
    refersTo: 'actors',
  },
];

module.exports = { films, persons, actors };
