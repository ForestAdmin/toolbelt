const _ = require('lodash');
const inquirer = require('inquirer');
const authenticator = require('../services/authenticator');
const path = require('path');

const FORMAT_PASSWORD = /^(?=\S*?[A-Z])(?=\S*?[a-z])((?=\S*?[0-9]))\S{8,}$/;

async function Prompter(requests) {
  function isRequested(option) {
    return requests.indexOf(option) > -1;
  }

  const envConfig = {};

  if (process.env.SERVER_HOST) {
    envConfig.serverHost = process.env.SERVER_HOST;
  } else {
    envConfig.serverHost = 'https://api.forestadmin.com';
  }

  const prompts = [];

  envConfig.authToken = authenticator.getAuthToken();

  if (isRequested('email')) {
    if (!envConfig.authToken) {
      prompts.push({
        type: 'input',
        name: 'email',
        message: 'What\'s your email address? ',
        validate: (email) => {
          if (email) { return true; }
          return '🔥  Please enter your email address 🔥';
        },
      });
    }
  }

  if (isRequested('password')) {
    prompts.push({
      type: 'password',
      name: 'password',
      message: 'What\'s your password: ',
      validate: (password) => {
        if (password) {
          return true;
        } else {
          return '🔥  Oops, your password cannot be blank 🔥';
        }
      }
    });
  }

  const config = await inquirer.prompt(prompts);

  return _.merge(config, envConfig);
}

module.exports = Prompter;
