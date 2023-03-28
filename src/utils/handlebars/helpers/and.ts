import Handlebars from 'handlebars';

Handlebars.registerHelper('and', (value1, value2) => Boolean(value1 && value2));
