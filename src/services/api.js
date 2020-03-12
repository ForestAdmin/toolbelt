const agent = require('superagent');
const pkg = require('../../package.json');

const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CONTENT_TYPE_JSON = 'application/json';
const HEADER_FOREST_ORIGIN = 'forest-origin';
const HEADER_USER_AGENT = 'User-Agent';

function API() {
  this.endpoint = process.env.FOREST_URL || 'https://api.forestadmin.com';
  this.userAgent = `forest-cli@${pkg.version}`;

  this.isGoogleAccount = async (email) => agent
    .get(`${this.endpoint}/api/users/google/${email}`)
    .set(HEADER_FOREST_ORIGIN, 'forest-cli')
    .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
    .set(HEADER_USER_AGENT, this.userAgent)
    .send()
    .then((response) => response.body.data.isGoogleAccount)
    .catch(() => false);

  this.login = async (email, password) => agent
    .post(`${this.endpoint}/api/sessions`)
    .set(HEADER_FOREST_ORIGIN, 'forest-cli')
    .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
    .set(HEADER_USER_AGENT, this.userAgent)
    .send({ email, password })
    .then((response) => response.body.token);
}

module.exports = new API();
