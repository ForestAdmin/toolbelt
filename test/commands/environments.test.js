const nock = require('nock');
const jwt = require('jsonwebtoken');
const testDialog = require('./test-cli');
const ProjectSerializer = require('../../src/serializers/project');
const EnvironmentSerializer = require('../../src/serializers/environment');
const EnvironmentCommand = require('../../src/commands/environments');

describe('environments', () => {
  it('should display environment list', () => testDialog({
    env: {
      FOREST_URL: 'http://localhost:3001',
      TOKEN_PATH: '.',
    },
    command: () => EnvironmentCommand.run([]),
    nock: [
      nock('http://localhost:3001')
        .get('/api/users/google/some@mail.com')
        .reply(200, { data: { isGoogleAccount: false } }),
      nock('http://localhost:3001')
        .post('/api/sessions', { email: 'some@mail.com', password: 'valid_pwd' })
        .reply(200, { token: jwt.sign({}, 'key', { expiresIn: '1day' }) }),
      nock('http://localhost:3001')
        .get('/api/projects')
        .reply(200, ProjectSerializer.serialize([
          { id: 1, name: 'project1' },
          { id: 2, name: 'project2' },
        ])),
      nock('http://localhost:3001')
        .get('/api/projects/2/environments')
        .reply(200, EnvironmentSerializer.serialize([
          {
            id: 3, name: 'name1', apiEndpoint: 'http://localhost:1', type: 'type1',
          },
          {
            id: 4, name: 'name2', apiEndpoint: 'http://localhost:2', type: 'type2',
          },
        ])),
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
