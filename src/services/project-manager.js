const _ = require('lodash');
const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const ProjectSerializer = require('../serializers/project');
const ProjectDeserializer = require('../deserializers/project');

function ProjectManager(config) {
  function deserialize(response) {
    const attrs = _.clone(ProjectSerializer.opts.attributes);
    attrs.push('id');

    return ProjectDeserializer
      .deserialize(response.body)
      .then((deserialized) => {
        if (_.isArray(deserialized)) {
          return deserialized.map(d => _.pick(d, attrs));
        }

        return _.pick(deserialized, attrs);
      });
  }

  this.listProjects = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${config.serverHost}/api/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .send()
      .then(response => deserialize(response));
  };

  this.getProject = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${config.serverHost}/api/projects/${config.projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .send()
      .then(response => deserialize(response));
  };
}

module.exports = ProjectManager;
