const { chars } = require('./defaults');

class EnvironmentRenderer {
  constructor({
    assertPresent,
    chalk,
    logger,
    Table,
    diffString,
  }) {
    assertPresent({
      chalk,
      logger,
      Table,
      diffString,
    });
    this.chalk = chalk;
    this.logger = logger;
    this.Table = Table;
    this.diffString = diffString;
  }

  render(environment, config) {
    const table = new this.Table({
      chars,
    });

    switch (config.format) {
      case 'json':
        this.logger.log(JSON.stringify(environment, null, 2));
        break;
      case 'table':
        table.push(
          { id: environment.id || '' },
          { name: environment.name || '' },
          { url: environment.apiEndpoint || '' },
          { active: environment.isActive || '' },
          { type: environment.type || '' },
          { liana: environment.lianaName || '' },
          { version: environment.lianaVersion || '' },
          { FOREST_ENV_SECRET: environment.secretKey || '' },
        );
        if (environment.authSecret) table.push({ FOREST_AUTH_SECRET: environment.authSecret });
        this.logger.log(
          `${this.chalk.bold('ENVIRONMENT')}`,
          ...table.toString().split('\n'),
        );
        break;
      default:
    }
  }

  renderApimapDiff(apimapFrom, apimapTo) {
    const diff = this.diffString(apimapFrom, apimapTo);
    if (diff) {
      this.logger.log(this.chalk.bold.yellow('⚠ The schemas have differences.'));
      this.logger.log(diff);
    } else {
      this.logger.log(this.chalk.bold.green('√ The schemas are identical.'));
    }
  }
}

module.exports = EnvironmentRenderer;
