import Handlebars from 'handlebars';

function wrapSpecialCharacters(value) {
  return /\s|-|@/.test(value) ? `'${value}'` : value;
}

Handlebars.registerHelper('wsc', wrapSpecialCharacters);

export default wrapSpecialCharacters;
