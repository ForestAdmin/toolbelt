const _ = require('lodash');
const inquirer = require('inquirer');
const context = require('@forestadmin/context');

const promptEmail = {
  type: 'input',
  name: 'email',
  message: 'What\'s your email address? ',
  validate: (email) => {
    if (email) { return true; }
    return 'Please enter your email address';
  },
};

const promptPassword = {
  type: 'password',
  name: 'password',
  message: 'What\'s your password: ',
  validate: (password) => {
    if (password) { return true; }
    return 'Oops, your password cannot be blank';
  },
};

async function Prompter(requests) {
  const { env } = context.inject();

  function isRequested(option) {
    return requests.indexOf(option) > -1;
  }

  const prompts = [];

  if (isRequested('email')) {
    if (!env.FOREST_EMAIL) {
      prompts.push(promptEmail);
    }
  }

  if (isRequested('password')) {
    if (!env.FOREST_PASSWORD) {
      prompts.push(promptPassword);
    }
  }

  const config = await inquirer.prompt(prompts);

  return _.merge(config, env);
}

module.exports = Prompter;
