const Handlebars = require('handlebars');

Handlebars.registerHelper('or', (value1, value2) => Boolean(value1 || value2));
