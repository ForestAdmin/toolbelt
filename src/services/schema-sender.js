const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const config = require('../config');
const logger = require('../services/logger');

function SchemaSender(serializedSchema, secret, oclifExit) {
  this.perform = () =>
    agent
      .post(`${config.serverHost()}/forest/apimaps`)
      .set('forest-secret-key', secret)
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
}

module.exports = SchemaSender;
