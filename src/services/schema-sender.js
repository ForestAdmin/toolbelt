const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const Context = require('@forestadmin/context');

/**
 * @class
 * @param {string} serializedSchema
 * @param {string} secret
 * @param {string} authenticationToken
 * @param {(code: number) => void} oclifExit
 */
function SchemaSender(serializedSchema, secret, authenticationToken, oclifExit) {
  /**
   * @function
   * @returns {Promise<number | undefined>}
   */
  this.perform = () => {
    const { env, logger } = Context.inject();

    return agent
      .post(`${env.FOREST_URL}/forest/apimaps`)
      .set('forest-secret-key', secret)
      .set('Authorization', `Bearer ${authenticationToken}`)
      .send(serializedSchema)
      .then(({ body }) => {
        if (body && body.meta) {
          return body.meta.job_id;
        }

        return null;
      })
      .catch((error) => {
        if ([200, 202, 204].indexOf(error.status) !== -1) {
          if (error.body && error.body.warning) {
            logger.error(error.body.warning);
            oclifExit(1);
          }
        } else if (error.status === 0) {
          logger.error('Cannot send the forest schema to Forest. Are you online?');
          oclifExit(3);
        } else if (error.status === 404) {
          logger.error('Cannot find the project related to the environment secret you configured.');
          oclifExit(4);
        } else if (error.status === 503) {
          logger.error('Forest is in maintenance for a few minutes. We are upgrading your experience in the forest. We just need a few more minutes to get it right.');
          oclifExit(5);
        } else {
          logger.error('An error occured with the schema sent to Forest. Please contact support@forestadmin.com for further investigations.');
          oclifExit(6);
        }
      });
  };
}

module.exports = SchemaSender;
