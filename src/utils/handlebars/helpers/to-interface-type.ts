import * as Handlebars from 'handlebars';

const toInterfaceType = type => {
  switch (type) {
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'Date';
    case 'Mongoose.Schema.Types.ObjectId':
    case 'ambiguous':
      return 'Mongoose.Types.ObjectId';
    case '[Mongoose.Schema.Types.ObjectId]':
      return 'Array<Mongoose.Types.ObjectId>';
    default:
      return 'object';
  }
};

Handlebars.registerHelper('toInterfaceType', toInterfaceType);
