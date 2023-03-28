import Handlebars from 'handlebars';

Handlebars.registerHelper('capitalise', value => value.charAt(0).toUpperCase() + value.slice(1));
