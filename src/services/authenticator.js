const fs = require('fs');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const jwtDecode = require('jwt-decode');
const Joi = require('joi');
const api = require('./api');
const logger = require('./logger');
const ERROR_UNEXPECTED = require('../utils/messages');

function Authenticator() {
  this.getAuthToken = (path = process.env.TOKEN_PATH || os.homedir()) => {
    const forestrcToken = this.getVerifiedToken(`${path}/.forestrc`);
    return forestrcToken || this.getVerifiedToken(`${path}/.lumberrc`);
  };

  this.getVerifiedToken = (path) => {
    const token = this.readAuthTokenFrom(path);
    return token && this.verify(token);
  };

  this.readAuthTokenFrom = (path) => {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      return null;
    }
  };

  this.pathToForestrc = `${os.homedir()}/.forestrc`;

  this.saveToken = (token) => fs.writeFileSync(this.pathToForestrc, token);

  this.verify = (token) => {
    if (!token) return null;
    let decodedToken;
    try {
      decodedToken = jwtDecode(token);
    } catch (error) {
      return null;
    }
    const nowInSeconds = Date.now().valueOf() / 1000;
    if (decodedToken.exp && nowInSeconds < decodedToken.exp) {
      return token;
    }
    return null;
  };

  this.validateToken = (token) => !!this.verify(token)
    || 'Invalid token. Please enter your authentication token.';

  this.logout = async (opts = {}) => {
    const pathForestrc = `${os.homedir()}/.forestrc`;
    const isForestLoggedIn = this.getVerifiedToken(pathForestrc);
    const pathLumberrc = `${os.homedir()}/.lumberrc`;
    const isLumberLoggedIn = this.getVerifiedToken(pathLumberrc);

    if (isForestLoggedIn) {
      fs.unlinkSync(pathForestrc);
    }
    if (opts.log) {
      if (isLumberLoggedIn) {
        logger.info('You cannot be logged out with this command. Please use "lumber logout" command.');
      } else {
        logger.info(chalk.green('You are unlogged.'));
      }
    }
  };

  this.tryLogin = async (config) => {
    await this.logout({ log: false });
    try {
      const token = await this.login(config);
      this.saveToken(token);
      logger.info('Login successful');
    } catch (error) {
      const message = error.message === 'Unauthorized'
        ? 'Incorrect email or password.'
        : `${ERROR_UNEXPECTED} ${chalk.red(error)}`;
      logger.error(message);
    }
  };

  this.loginWithToken = (token) => {
    const validationResult = this.validateToken(token);
    if (validationResult !== true) {
      throw new Error(validationResult);
    }
    return token;
  };

  this.login = async ({ email, password, token }) => {
    if (email) {
      const validationResult = await this.validateEmail(email);
      if (validationResult !== true) {
        throw new Error(validationResult);
      }
    } else email = await this.promptEmail();

    if (token) {
      return this.loginWithToken(token);
    }

    const isGoogleAccount = await api.isGoogleAccount(email);
    if (isGoogleAccount) {
      return this.loginWithGoogle();
    }
    return this.loginWithPassword(email, password);
  };

  this.validateEmail = (input) => {
    if (!Joi.string().email().validate(input).error) {
      return true;
    }
    return input ? 'Invalid email' : 'Please enter your email address.';
  };

  this.promptEmail = async () => {
    const { email } = await inquirer.prompt([{
      type: 'input',
      name: 'email',
      message: 'What is your email address?',
      validate: this.validateEmail,
    }]);
    return email;
  };

  this.loginWithGoogle = async () => {
    const endpoint = process.env.FOREST_URL && process.env.FOREST_URL.includes('localhost')
      ? 'http://localhost:4200' : 'https://app.forestadmin.com';
    const url = chalk.cyan.underline(`${endpoint}/authentication-token`);
    logger.info(`To authenticate with your Google account, please follow this link and copy the authentication token: ${url}`);

    const { sessionToken } = await inquirer.prompt([{
      type: 'password',
      name: 'sessionToken',
      message: 'Enter your Forest Admin authentication token:',
      validate: this.validateToken,
    }]);
    return sessionToken;
  };

  this.loginWithPassword = async (email, password) => {
    if (!password) {
      ({ password } = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        message: 'What is your Forest Admin password:',
        validate: (input) => !!input || 'Please enter your password.',
      }]));
    }
    return api.login(email, password);
  };
}

module.exports = new Authenticator();
