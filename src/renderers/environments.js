const chalk = require('chalk');
const Table = require('cli-table');

class EnvironmentsRenderer {
  constructor(config) {
    this.config = config;
  }

  render(environments) {
    switch (this.config.format) {
      case 'json':
        console.log(JSON.stringify(environments, null, 2));
        break;
      case 'table':
        console.log(`${chalk.bold('ENVIRONMENTS')}`);

        const table = new Table({
          head: ['ID', 'NAME', 'URL', 'TYPE'],
          colWidths: [10, 20, 35, 15],
          chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
            , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
            , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
            , 'right': '' , 'right-mid': '' , 'middle': '' }
        });

        environments.forEach((environment) => {
          table.push([environment.id, environment.name, environment.apiEndpoint,
            environment.type]);
        });

        console.log(table.toString());
        console.log('\n');
        break;
    }
  }
}

module.exports = EnvironmentsRenderer;
