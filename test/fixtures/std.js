module.exports = {
  arrowDown: [
    { in: '\u001b[B' },
  ],
  enter: [
    { in: '' },
  ],
  loginRequired: [
    { out: 'Login required.' },
  ],
  databaseDialog: (databaseName) => [
    { out: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?' },
    { in: '' },
    { out: 'What\'s the database type?' },
    { in: '' },
    { out: 'What\'s the database name?' },
    { in: `${databaseName}` },
    { out: 'What\'s the database schema?' },
    { in: '' },
    { out: 'What\'s the database hostname?' },
    { in: '' },
    { out: 'What\'s the database port?' },
    { in: '' },
    { out: 'What\'s the database user?' },
    { in: '' },
    { out: 'What\'s the database password? [optional]' },
    { in: '' },
    { out: 'Does your database require a SSL connection?' },
    { in: '' },
  ],
};
