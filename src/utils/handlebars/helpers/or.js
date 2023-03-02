const Handlebars = require('handlebars');

Handlebars.registerHelper('or', (value1, value2) => value1 || value2);
