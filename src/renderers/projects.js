const chalk = require('chalk');
const Table = require('cli-table');

class ProjectsRenderer {
  constructor(config) {
    this.config = config;
  }

  render(projects) {
    switch (this.config.format) {
      case 'json':
        console.log(JSON.stringify(projects, null, 2));
        break;
      case 'table':
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
        break;
    }
  }
}

module.exports = ProjectsRenderer;
