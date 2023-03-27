const { ObjectID } = require('mongodb');

const persons = [
  {
    _id: ObjectID(),
    name: 'James Cameron',
  },
];

const films = [
  {
    _id: ObjectID(),
    title: 'Terminator',
    author: persons.find(person => person.name === 'James Cameron')._id,
  },
];

module.exports = { films, persons };
