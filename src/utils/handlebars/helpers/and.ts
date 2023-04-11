import Handlebars from 'handlebars';

function and(value1, value2) {
  return Boolean(value1 && value2);
}

Handlebars.registerHelper('and', and);

export default and;
