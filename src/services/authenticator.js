const fs = require('fs');
const os = require('os');
const P = require('bluebird');
const chalk = require('chalk');
const agent = require('superagent-promise')(require('superagent'), P);
const logger = require('./logger');

function Authenticator() {
  this.getAuthToken = () => {
    try {
      return fs.readFileSync(`${os.homedir()}/.forestrc`);
    } catch (e) {
      return null;
    }
  };

  this.login = config =>
    agent
      .post(`${config.serverHost}/api/sessions`, {
        email: config.email,
        password: config.password,
      })
      .then(response => response.body)
      .then((auth) => {
        config.authToken = auth.token;
        return fs.writeFileSync(`${os.homedir()}/.forestrc`, auth.token);
      });

  this.logout = async (opts) => {
    const path = `${os.homedir()}/.forestrc`;

    return new P((resolve, reject) => {
      fs.stat(path, (err) => {
        if (err === null) {
          fs.unlinkSync(path);

          if (opts.log) {
            console.log(chalk.green('👍  You\'re now unlogged 👍 '));
          }

          resolve();
        } else if (err.code === 'ENOENT') {
          if (opts.log) {
            logger.error('🔥  You\'re not logged 🔥');
          }

          resolve();
        } else {
          reject(err);
        }
      });
    });
  };
}

module.exports = new Authenticator();
