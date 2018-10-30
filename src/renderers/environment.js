const chalk = require('chalk');
const Table = require('cli-table');

class EnvironmentRenderer {
  constructor(config) {
    this.config = config;
  }

  render(environment) {
    const table = new Table({
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: '',
      },
    });

    switch (this.config.format) {
      case 'json':
        console.log(JSON.stringify(environment, null, 2));
        break;
      case 'table':
        console.log(`${chalk.bold('ENVIRONMENT')}`);

        table.push(
          { id: environment.id },
          { name: environment.name },
          { url: environment.apiEndpoint },
          { active: environment.isActive },
          { type: environment.type },
          { liana: environment.lianaName },
          { version: environment.lianaVersion },
          { FOREST_ENV_SECRET: environment.secretKey },
        );

        console.log(table.toString());
        break;
      default:
    }
  }
}

module.exports = EnvironmentRenderer;
