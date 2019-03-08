const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const config = require('../config');
const { logError } = require('../utils');

function SchemaSender(serializedSchema, secret) {
  this.perform = () =>
    agent
      .post(`${config.serverHost}/forest/apimaps`)
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
            logError(error.body.warning, { exit: 1 });
          }
        } else if (error.status === 0) {
          logError('Cannot send the forest schema to Forest. Are you online?', { exit: 3 });
        } else if (error.status === 404) {
          logError('Cannot find the project related to the environment secret you configured.', { exit: 4 });
        } else if (error.status === 503) {
          logError('Forest is in maintenance for a few minutes. We are upgrading your experience in the forest. We just need a few more minutes to get it right.', { exit: 5 });
        } else {
          logError('An error occured with the schema sent to Forest. Please contact support@forestadmin.com for further investigations.', { exit: 6 });
        }
      });
}

module.exports = SchemaSender;
