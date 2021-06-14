const chalk = require('chalk');
const os = require('os');
const superagent = require('superagent');
const inquirer = require('inquirer');
const openIdClient = require('openid-client');
const open = require('open');
const jwtDecode = require('jwt-decode');
const fs = require('fs');
const joi = require('joi');

module.exports = (plan) => plan
  .addStep('open', (planOpen) => planOpen
    .addFunction('open', open))
  .addStep('std', (planStd) => planStd
    .addInstance('stdout', process.stdout)
    .addInstance('stderr', process.stderr))
  .addStep('inquirer', (planInquirer) => planInquirer
    .addInstance('inquirer', inquirer))
  .addStep('others', (planOthers) => planOthers
    .addInstance('chalk', chalk)
    .addInstance('os', os)
    .addInstance('fs', fs)
    .addInstance('superagent', superagent)
    .addInstance('openIdClient', openIdClient)
    .addInstance('jwtDecode', jwtDecode)
    .addInstance('joi', joi));
