const chalk = require('chalk');
const crypto = require('crypto');
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
    .addFunction('stdout', process.stdout)
    .addFunction('stderr', process.stderr))
  .addStep('inquirer', (planInquirer) => planInquirer
    .addInstance('inquirer', inquirer))
  .addStep('others', (planOthers) => planOthers
    .addModule('chalk', chalk)
    .addModule('crypto', crypto)
    .addModule('os', os)
    .addModule('fs', fs)
    .addModule('superagent', superagent)
    .addModule('openIdClient', openIdClient)
    .addModule('jwtDecode', jwtDecode)
    .addModule('joi', joi));
