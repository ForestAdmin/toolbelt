const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const ProjectManager = require('../../services/project-manager');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class GetCommand extends Command {
  async run() {
    const { args } = this.parse(GetCommand);

    let config = await Prompter([]);
    config = _.merge(config, flags, args);

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject(config);

      console.log(`${chalk.bold('PROJECT')}`);

      const table = new Table({
        chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
          , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
          , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
          , 'right': '' , 'right-mid': '' , 'middle': '' }
      });

      table.push(
        { id: project.id },
        { name: project.name },
        { 'default environment': project.defaultEnvironment.type },
      );

      console.log(table.toString());
    } catch (err) {
      console.log(err);
      logger.error(`Cannot find the project ${chalk.bold(config.projectId)}.`);
    }
  }
}

GetCommand.description = `Get the configuration of a project`;

GetCommand.args = [{
  name: 'projectId', required: true, description: 'ID of a project'
}];

module.exports = GetCommand
