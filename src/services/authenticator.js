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
    } catch (error) {
      return null;
    }
  };

  this.login = config => {
    return agent
      .post(`${config.serverHost}/api/sessions`, {
        email: config.email,
        password: config.password,
      })
      .then(response => response.body)
      .then((auth) => {
        config.authToken = auth.token;
        return fs.writeFileSync(`${os.homedir()}/.forestrc`, auth.token);
      });

  this.logout = async (opts = {}) => {
    const path = `${os.homedir()}/.forestrc`;

    return new P((resolve, reject) => {
      fs.stat(path, (error) => {
        if (error === null) {
          fs.unlinkSync(path);

          if (opts.log) {
            console.log(chalk.green('👍  You\'re now unlogged 👍 '));
          }

          resolve();
        } else if (error.code === 'ENOENT') {
          if (opts.log) {
            logger.error('🔥  You\'re not logged 🔥');
          }

          resolve();
        } else {
          reject(error);
        }
      });
    });
  };
}

module.exports = new Authenticator();
