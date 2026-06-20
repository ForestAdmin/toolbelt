const { chars } = require('./defaults');

class UsersRenderer {
  constructor({ assertPresent, chalk, logger, Table }) {
    assertPresent({ chalk, logger, Table });
    this.chalk = chalk;
    this.logger = logger;
    this.Table = Table;
  }

  render(users, config) {
    switch (config.format) {
      case 'json':
        this.logger.log(JSON.stringify(users, null, 2));
        break;
      case 'table': {
        const table = new this.Table({
          head: ['EMAIL', 'NAME', 'PERMISSION LEVEL', 'TEAMS'],
          colWidths: [40, 25, 20, 30],
          chars,
        });
        users.forEach(user => {
          table.push([
            user.email,
            user.name || '',
            user.permissionLevel || '',
            (user.teams || []).join(', '),
          ]);
        });
        this.logger.log(`${this.chalk.bold('USERS')}`, ...table.toString().split('\n'));
        break;
      }
      default:
    }
  }
}

module.exports = UsersRenderer;
