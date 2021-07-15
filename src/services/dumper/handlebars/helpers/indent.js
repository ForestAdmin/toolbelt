const Handlebars = require('handlebars');

Handlebars.registerHelper('indent', (level, value) => ' '.repeat(level * 2) + value);
