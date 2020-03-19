const testDialog = require('./test-cli');
const EnvironmentCommand = require('../../src/commands/environments');
const { testEnv } = require('../fixtures/envs');
const {
  notAGoogleAccountNock,
  validAuthNock,
  projectListNock,
  environmentListNock,
} = require('../fixtures/nocks');

describe('environments', () => {
  it('should display environment list', () => testDialog({
    env: testEnv,
    command: () => EnvironmentCommand.run([]),
    nock: [
      notAGoogleAccountNock(),
      validAuthNock(),
      projectListNock(),
      environmentListNock(),
    ],
    dialog: [
      { out: 'Login required.' },
      { out: 'What is your email address?' },
      { in: 'some@mail.com' },
      { out: 'What is your Forest Admin password: [input is hidden] ?' },
      { in: 'valid_pwd' },
      { out: 'Login successful' },
      { in: '\u001b[B' }, // Notice: Arrow down
      { in: '\r' }, // Notice: Carriage return
      { out: 'ENVIRONMENTS' },
      { out: 'ID        NAME                URL                                TYPE' },
      { out: '3         name1               http://localhost:1                 type1' },
      { out: '4         name2               http://localhost:2                 type2' },
    ],
  }));
});
