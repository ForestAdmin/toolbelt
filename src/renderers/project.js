const { chars } = require('./defaults');

class ProjectRenderer {
  constructor({ assertPresent, chalk, logger, Table }) {
    assertPresent({
      chalk,
      logger,
      Table,
    });
    this.chalk = chalk;
    this.logger = logger;
    this.Table = Table;
  }

  render(project, config) {
    const table = new this.Table({
      chars,
    });

    switch (config.format) {
      case 'json':
        this.logger.log(JSON.stringify(project, null, 2));
        break;
      case 'table':
        table.push(
          { id: project.id || '' },
          { name: project.name || '' },
          { 'default environment': project.defaultEnvironment.type || '' },
        );
        this.logger.log(`${this.chalk.bold('PROJECT')}`, ...table.toString().split('\n'));
        break;
      default:
    }
  }
}

module.exports = ProjectRenderer;
