import Handlebars from 'handlebars';

function capitalise(value) {
  if (![undefined, null].indexOf(value)) return null;

  return value?.charAt(0).toUpperCase() + value.slice(1);
}

Handlebars.registerHelper('capitalise', capitalise);

export default capitalise;
