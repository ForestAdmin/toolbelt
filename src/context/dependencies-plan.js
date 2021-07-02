const chalk = require('chalk');
const crypto = require('crypto');
const fs = require('fs');
const inquirer = require('inquirer');
const joi = require('joi');
const jwtDecode = require('jwt-decode');
const open = require('open');
const openIdClient = require('openid-client');
const os = require('os');
const superagent = require('superagent');
const Table = require('cli-table');

module.exports = (plan) => plan
  .addStep('open', (planOpen) => planOpen
    .addFunction('open', open))
  .addStep('std', (planStd) => planStd
    .addFunction('stdout', process.stdout)
    .addFunction('stderr', process.stderr))
  .addStep('inquirer', (planInquirer) => planInquirer
    .addInstance('inquirer', inquirer))
  .addStep('jwtDecode', (planJWTDecode) => planJWTDecode
    .addInstance('jwtDecode', jwtDecode))
  .addStep('others', (planOthers) => planOthers
    .addInstance('Table', Table)
    .addModule('chalk', chalk)
    .addModule('crypto', crypto)
    .addModule('fs', fs)
    .addModule('joi', joi)
    .addModule('openIdClient', openIdClient)
    .addModule('os', os)
    .addModule('superagent', superagent));
