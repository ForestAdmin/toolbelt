const chalk = require('chalk');
const Table = require('cli-table');

class ProjectRenderer {
  constructor(config) {
    this.config = config;
  }

  render(project) {
    switch (this.config.format) {
      case 'json':
        console.log(JSON.stringify(project, null, 2));
        break;
      case 'table':
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
        break;
    }
  }
}

module.exports = ProjectRenderer;
