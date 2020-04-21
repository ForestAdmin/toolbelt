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
  delete: flags.string({
    char: 'd',
    description: 'Delete the branch',
  }),
  projectId: flags.string({
    char: 'p',
    description: 'The id of the project to create a branch in',
  }),
  force: flags.boolean({
    char: 'force',
    description: 'When deleting a branch, skip confirmation',
  }),
};

BranchCommand.args = [{
  name: 'branchName', required: false, description: 'The name of the branch to create',
}];

module.exports = BranchCommand;
