class ApplicationTokenService {
  /**
   * @param {import("../context/init").Context} context
   */
  constructor({ api, os }) {
    /** @private @readonly */
    this.api = api;
    /** @private @readonly */
    this.os = os;

    ['api', 'os'].forEach((name) => {
      if (!this[name]) throw new Error(`Missing dependency ${name}`);
    });
  }

  /**
   * @param {string} sessionToken
   * @returns {Promise<string>}
   */
  async generateApplicationToken(sessionToken) {
    const hostname = this.os.hostname();
    const inputToken = {
      name: `forest-cli @${hostname}`,
    };

    try {
      const applicationToken = await this.api.createApplicationToken(inputToken, sessionToken);

      return applicationToken.token;
    } catch (e) {
      throw new Error(`Unable to create an application token: ${e.message}.`);
    }
  }

  /**
   * @param {string} sessionToken
   * @returns {Promise<void>}
   */
  async deleteApplicationToken(sessionToken) {
    try {
      await this.api.deleteApplicationToken(sessionToken);
    } catch (error) {
      if (error.status === 404) {
        return;
      }

      throw error;
    }
  }
}

module.exports = ApplicationTokenService;
