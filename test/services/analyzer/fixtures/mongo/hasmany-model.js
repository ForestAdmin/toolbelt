const { ObjectID } = require('mongodb');

const persons = [
  {
    _id: ObjectID(),
    name: 'James Cameron',
  },
  {
    _id: ObjectID(),
    name: 'Sam Worthington',
  },
  {
    _id: ObjectID(),
    name: 'Zoe Saldana',
  },
];

const films = [
  {
    _id: ObjectID(),
    title: 'Terminator',
    author: persons.find(person => person.name === 'James Cameron')._id,
    actors: [
      persons.find(person => person.name === 'Sam Worthington')._id,
      persons.find(person => person.name === 'Zoe Saldana')._id,
    ],
  },
];

module.exports = { films, persons };
