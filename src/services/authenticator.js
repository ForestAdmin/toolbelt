const ApplicationError = require('../utils/application-error');
const { ERROR_UNEXPECTED } = require('../utils/messages');

/**
 * @class
 * @param {import('../context/init').Context} context
 */
function Authenticator({
  logger, api, chalk, inquirer, os, jwtDecode, fs, joi, env,
  oidcAuthenticator, applicationTokenService,
}) {
  /**
   * @param {string?} path
   * @returns {string}
   */
  this.getAuthToken = (path = env.TOKEN_PATH || os.homedir()) => {
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

  this.saveToken = (token, path = env.TOKEN_PATH || os.homedir()) => fs
    .writeFileSync(`${path}/.forestrc`, token);

  this.verify = (token) => {
    if (!token) return null;
    let decodedToken;
    try {
      decodedToken = jwtDecode(token);
    } catch (error) {
      return null;
    }
    const nowInSeconds = Date.now().valueOf() / 1000;
    if (!decodedToken.exp || nowInSeconds < decodedToken.exp) {
      return token;
    }
    return null;
  };

  this.validateToken = (token) => !!this.verify(token)
    || 'Invalid token. Please enter your authentication token.';

  this.logout = async (opts = {}) => {
    const pathForestrc = `${os.homedir()}/.forestrc`;
    const forestToken = this.getVerifiedToken(pathForestrc);
    const pathLumberrc = `${os.homedir()}/.lumberrc`;
    const isLumberLoggedIn = this.getVerifiedToken(pathLumberrc);

    if (forestToken) {
      fs.unlinkSync(pathForestrc);
      await applicationTokenService.deleteApplicationToken(forestToken);
    }
    if (opts.log) {
      if (isLumberLoggedIn) {
        logger.info('You cannot be logged out with this command. Please use "lumber logout" command.');
      } else {
        logger.info(chalk.green('You are logged out.'));
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
      const message = error instanceof ApplicationError
        ? error.message
        : `${ERROR_UNEXPECTED} ${chalk.red(error)}`;
      logger.error(message);
    }
  };

  /**
   * @param {{
    *  email: string;
    *  password: string;
    *  token: string;
    * }} params
    * @returns {Promise<string>}
    */
  this.login = async ({ email, password, token }) => {
    if (!password && !token) {
      const sessionToken = await oidcAuthenticator.authenticate();
      return applicationTokenService.generateApplicationToken(sessionToken);
    }

    if (email) {
      const validationResult = await this.validateEmail(email);
      if (validationResult !== true) {
        throw new ApplicationError(validationResult);
      }
    } else email = await this.promptEmail();

    if (token) {
      return this.loginWithToken(token);
    }

    try {
      return await this.loginWithPassword(email, password);
    } catch (e) {
      if (e.message === 'Unauthorized') {
        throw new ApplicationError('Incorrect email or password.');
      }

      throw e;
    }
  };

  this.loginWithToken = (token) => {
    const validationResult = this.validateToken(token);
    if (validationResult !== true) {
      throw new ApplicationError(validationResult);
    }
    return token;
  };

  this.validateEmail = (input) => {
    if (!joi.string().email().validate(input).error) {
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

module.exports = Authenticator;
