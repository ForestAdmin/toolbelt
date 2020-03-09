const api = require('./api');
const { terminate } = require('../utils/terminator');
const ERROR_UNEXPECTED = require('../utils/messages');
const fs = require('fs');
const os = require('os');
const P = require('bluebird');
const inquirer = require('inquirer');
const jwtDecode = require('jwt-decode');
const chalk = require('chalk');
const logger = require('./logger');

function Authenticator() {
  this.getAuthToken = () => {
    try {
      return fs.readFileSync(`${os.homedir()}/.forestrc`);
    } catch (e) {
      return null;
    }
  };

  this.pathToForestrc = `${os.homedir()}/.forestrc`;

  this.saveToken = (token) => fs.writeFileSync(this.pathToForestrc, token);

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

  this.verify = (token) => {
    if (!token) return null;
    const decodedToken = jwtDecode(token);
    const nowInSeconds = Date.now().valueOf() / 1000;
    return decodedToken.exp && nowInSeconds < decodedToken.exp;
  };

  this.login = async (config) => {
    const { email, token } = config;
    if (this.verify(token)) return token;

    const isGoogleAccount = await api.isGoogleAccount(email);
    if (isGoogleAccount) {
      return this.loginWithGoogle(email);
    }

    return this.loginWithPassword(config);
  };

  this.loginWithEmailOrTokenArgv = async (config) => {
    try {
      const token = await this.login(config);
      this.saveToken(token);
    } catch (error) {
      const message = error.message === 'Unauthorized'
        ? 'Incorrect email or password.'
        : `${ERROR_UNEXPECTED} ${chalk.red(error)}`;

      return terminate(1, { logs: [message] });
    }
  };

  this.loginWithGoogle = async (email) => {
    const endpoint = process.env.FOREST_URL && process.env.FOREST_URL.includes('localhost')
      ? 'http://localhost:4200' : 'https://app.forestadmin.com';
    const url = chalk.cyan.underline(`${endpoint}/authentication-token`);
    logger.info(`To authenticate with your Google account, please follow this link and copy the authentication token: ${url}`);

    const { sessionToken } = await inquirer.prompt([{
      type: 'input',
      name: 'sessionToken',
      message: 'Enter your Forest Admin authentication token:',
      validate: (token) => this.verify(token) || 'Invalid token. Please enter your' +
        ' authentication token.',
    }]);
    return sessionToken;
  };

  this.loginWithPassword = async ({ email, password }) => {
    if (!password) {
      ({ password } = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'What\'s your Forest Admin password:',
        validate: (input) => !!input || 'Please enter your password.',
      }]));
    }
    return await api.login(email, password);
  };
}

module.exports = new Authenticator();
