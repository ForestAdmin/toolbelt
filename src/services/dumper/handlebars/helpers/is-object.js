const Handlebars = require('handlebars');

Handlebars.registerHelper('isObject', (value) => typeof value === 'object');
