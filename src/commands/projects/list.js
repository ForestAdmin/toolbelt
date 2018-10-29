const { Command, flags } = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const logger = require('../../services/logger');
const ProjectManager = require('../../services/project-manager');
const Prompter = require('../../services/prompter');

class ProjectCommand extends Command {
  async run() {
    let config = await Prompter([]);

    const manager = new ProjectManager(config);

    const projects = await manager.listProjects();
    console.log(`${chalk.bold('PROJECTS')}`);

    const table = new Table({
      head: ['ID', 'NAME'],
      colWidths: [10, 20],
      chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
        , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
        , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
        , 'right': '' , 'right-mid': '' , 'middle': '' }
    });

    projects.forEach((project) => {
      table.push([project.id, project.name]);
    });

    console.log(table.toString());
    console.log('\n');
  }
}

ProjectCommand.description = `List existing projects.`;

module.exports = ProjectCommand;
