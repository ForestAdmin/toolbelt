const _ = require('lodash');
const inquirer = require('inquirer');
const envConfig = require('../config');

async function Prompter(requests) {
  function isRequested(option) {
    return requests.indexOf(option) > -1;
  }

  const prompts = [];

  if (isRequested('email')) {
    if (process.env.FOREST_EMAIL) {
      envConfig.email = process.env.FOREST_EMAIL;
    } else {
      prompts.push({
        type: 'input',
        name: 'email',
        message: 'What\'s your email address? ',
        validate: (email) => {
          if (email) { return true; }
          return 'Please enter your email address';
        },
      });
    }
  }

  if (isRequested('password')) {
    if (process.env.FOREST_PASSWORD) {
      envConfig.password = process.env.FOREST_PASSWORD;
    } else {
      prompts.push({
        type: 'password',
        name: 'password',
        message: 'What\'s your password: ',
        validate: (password) => {
          if (password) { return true; }
          return 'Oops, your password cannot be blank';
        },
      });
    }
  }

  const config = await inquirer.prompt(prompts);

  return _.merge(config, envConfig);
}

module.exports = Prompter;
