const fs = require('fs');
const os = require('os');
const P = require('bluebird');
const chalk = require('chalk');
const agent = require('superagent-promise')(require('superagent'), P);
const jwtDecode = require('jwt-decode');
const logger = require('./logger');

function Authenticator() {
  this.getAuthToken = () => {
    const forestrcToken = this.getVerifiedToken(`${os.homedir()}/.forestrc`);
    return forestrcToken || this.getVerifiedToken(`${os.homedir()}/.lumberrc`);
  };

  this.getVerifiedToken = (path) => {
    const token = this.readAuthTokenFrom(path);
    return token && this.verify(token);
  };

  this.readAuthTokenFrom = (path) => {
    try {
      return fs.readFileSync(path);
    } catch (e) {
      return null;
    }
  };

  this.verify = (token) => {
    const decodedToken = jwtDecode(token);
    const nowInSeconds = Date.now().valueOf() / 1000;
    if (nowInSeconds < decodedToken.exp) {
      return token;
    }
    return null;
  };

  this.login = (config) =>
    agent
      .post(`${config.serverHost}/api/sessions`, {
        email: config.email,
        password: config.password,
      })
      .then((response) => response.body)
      .then((auth) => {
        config.authToken = auth.token;
        return fs.writeFileSync(`${os.homedir()}/.forestrc`, auth.token);
      });

  this.logout = async (opts = {}) => {
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
