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
  loginPasswordDialog: [
    { out: 'What is your email address?' },
    { in: 'some@mail.com' },
    { out: 'What is your Forest Admin password: [input is hidden] ?' },
    { in: 'valid_pwd' },
    { out: 'Login successful' },
  ],
};
