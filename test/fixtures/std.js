module.exports = {
  arrowDown: [
    { in: '\u001b[B' },
  ],
  enter: [
    { in: '\r' },
  ],
  loginRequired: [
    { out: 'Login required.' },
  ],
  databaseDialog: (databaseName) => [
    { out: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?' },
    { in: '\r' },
    { out: 'What\'s the database type?' },
    { in: '\r' },
    { out: 'What\'s the database name?' },
    { in: databaseName },
    { out: 'What\'s the database schema?' },
    { in: '\r' },
    { out: 'What\'s the database hostname?' },
    { in: '\r' },
    { out: 'What\'s the database port?' },
    { in: '\r' },
    { out: 'What\'s the database user?' },
    { in: '\r' },
    { out: 'What\'s the database password? [optional]' },
    { in: '\r' },
    { out: 'Does your database require a SSL connection?' },
    { in: '\r' },
  ],
};