const testCli = require('./../test-cli');
const UpdateCommand = require('../../../src/commands/schema/update');

describe('schema:update', () => {
  describe('when the user is not logged in', () => {
    it('should login the user and then send the schema', () => testCli({
      print: true,
      commandClass: UpdateCommand,
      env: {
        DATABASE_SCHEMA: 'public',
      },
      std: [
        { out: 'this is to be continued' },
      ],
    }));
  });
});
