const { chars } = require('./defaults');

class EnvironmentsRenderer {
  constructor({
    assertPresent,
    chalk,
    logger,
    Table,
  }) {
    assertPresent({
      chalk,
      logger,
      Table,
    });
    this.chalk = chalk;
    this.logger = logger;
    this.Table = Table;
  }

  render(environments, config) {
    const table = new this.Table({
      head: ['ID', 'NAME', 'URL', 'TYPE'],
      colWidths: [10, 20, 35, 15],
      chars,
    });

    switch (config.format) {
      case 'json':
        this.logger.log(JSON.stringify(environments, null, 2));
        break;
      case 'table':
        environments.forEach((environment) => {
          table.push([environment.id, environment.name, environment.apiEndpoint,
            environment.type]);
        });
        this.logger.log(
          `${this.chalk.bold('ENVIRONMENTS')}`,
          ...table.toString().split('\n'),
        );
        break;
      default:
    }
  }
}

module.exports = EnvironmentsRenderer;
