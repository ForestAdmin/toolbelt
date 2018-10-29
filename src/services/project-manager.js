const _ = require('lodash');
const P = require('bluebird');
const chalk = require('chalk');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const ProjectDeserializer = require('../deserializers/project');
const logger = require('./logger');

function ProjectManager(config) {

  this.listProjects = async () => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .get(`${config.serverHost}/api/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .send()
      .then((response) => new ProjectDeserializer.deserialize(response.body));
  };

  this.getProject = async () => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .get(`${config.serverHost}/api/projects/${config.projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .send()
      .then(response => new ProjectDeserializer.deserialize(response.body));
  };
}

module.exports = ProjectManager;
