const ApplicationError = require('../errors/application-error');
const { ERROR_UNEXPECTED } = require('../utils/messages');

/**
 * @class
 * @param {import('../context/plan').Context} context
 */
function Authenticator({
  logger, api, chalk, inquirer, jwtDecode, fs, joi, env,
  oidcAuthenticator, applicationTokenService, mkdirp,
}) {
  /**
   * @param {string?} path
   * @returns {string|null}
   */
  this.getAuthToken = (path = env.TOKEN_PATH) => {
    const paths = [
      `${path}/.forest.d/.forestrc`,
      `${path}/.forestrc`,
      `${path}/.lumberrc`,
    ];
    for (let i = 0; i < paths.length; i += 1) {
      const token = this.getVerifiedToken(paths[i]);
      if (token) return token;
    }
    return null;
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

  this.saveToken = async (token) => {
    const path = `${env.TOKEN_PATH}/.forest.d`;
    await mkdirp(path);
    const forestrcPath = `${path}/.forestrc`;
    fs.writeFileSync(forestrcPath, token);
  };

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
    const basePath = env.TOKEN_PATH;

    const pathForestrc = `${basePath}/.forestrc`;
    const forestToken = this.getVerifiedToken(pathForestrc);
    if (forestToken) {
      fs.unlinkSync(pathForestrc);
      await applicationTokenService.deleteApplicationToken(forestToken);
    }

    const pathForestForestrc = `${basePath}/.forest.d/.forestrc`;
    const forestForestToken = this.getVerifiedToken(pathForestForestrc);
    if (forestForestToken) {
      fs.unlinkSync(pathForestForestrc);
      await applicationTokenService.deleteApplicationToken(forestForestToken);
    }

    if (opts.log) {
      const pathLumberrc = `${basePath}/.lumberrc`;
      const isLumberLoggedIn = this.getVerifiedToken(pathLumberrc);
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
      await this.saveToken(token);
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
    if (token !== undefined && typeof token === 'string' && !token.trim()) {
      throw new ApplicationError('The provided token is empty. Please provide a valid token.');
    }

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
