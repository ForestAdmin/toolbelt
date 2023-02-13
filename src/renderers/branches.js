const { chars } = require('./defaults');

class BranchesRenderer {
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

  render(branches, format) {
    const table = new this.Table({
      head: ['NAME', 'ORIGIN', 'IS CURRENT', 'CLOSED AT'],
      colWidths: [20, 20, 20, 30],
      chars,
    });

    switch (format) {
      case 'json':
        this.logger.log(JSON.stringify(branches, null, 2));
        break;
      case 'table':
        branches.forEach(branch => {
          table.push([
            branch.name,
            branch.originEnvironment ? branch.originEnvironment.name : '⚠️  No origin set',
            branch.isCurrent ? '✅' : '',
            branch.closedAt ? branch.closedAt : '',
          ]);
        });
        this.logger.log(`${this.chalk.bold('BRANCHES')}`, ...table.toString().split('\n'));
        break;
      default:
    }
  }
}

module.exports = BranchesRenderer;
