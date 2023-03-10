const { ObjectID } = require('mongodb');

const persons = [
  {
    _id: ObjectID(),
    name: 'James Cameron',
  },
];

const films = [];

for (let i = 0; i < 50; i += 1) {
  films.push({
    _id: ObjectID(),
    title: `Terminator #${i}`,
    author: null,
  });
}

films.push({
  _id: ObjectID(),
  title: 'Terminator',
  author: persons.find(person => person.name === 'James Cameron')._id,
});

for (let i = 0; i < 50; i += 1) {
  films.push({
    _id: ObjectID(),
    title: `Terminator 2 #${i}`,
  });
}

module.exports = { films, persons };
