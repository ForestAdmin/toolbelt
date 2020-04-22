const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');

class BranchCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    // eslint-disable-next-line no-unused-vars
    const parsed = this.parse(BranchCommand);
  }
}

BranchCommand.description = 'Create a new branch or list your existing branches';

BranchCommand.flags = {
  project: flags.string({
    char: 'p',
    description: 'The name of the project to create a branch in',
  }),
  delete: flags.boolean({
    char: 'd',
    description: 'Delete the branch',
  }),
  force: flags.boolean({
    description: 'When deleting a branch, skip confirmation',
  }),
  help: flags.boolean({
    description: 'Display usage information',
  }),
};

BranchCommand.args = [{
  name: 'BRANCH_NAME', required: false, description: 'The name of the branch to create',
}];

module.exports = BranchCommand;
