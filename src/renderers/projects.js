const { chars } = require('./defaults');

class ProjectsRenderer {
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

  render(projects, config) {
    const table = new this.Table({
      head: ['ID', 'NAME'],
      colWidths: [10, 20],
      chars,
    });

    switch (config.format) {
      case 'json':
        this.logger.log(JSON.stringify(projects, null, 2));
        break;
      case 'table':
        projects.forEach(project => {
          table.push([project.id, project.name]);
        });
        this.logger.log(`${this.chalk.bold('PROJECTS')}`, ...table.toString().split('\n'));
        break;
      default:
    }
  }
}

module.exports = ProjectsRenderer;
