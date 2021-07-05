const Handlebars = require('handlebars');

Handlebars.registerHelper('isArray', (value) => Array.isArray(value));
