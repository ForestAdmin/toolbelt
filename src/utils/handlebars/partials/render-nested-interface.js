const Handlebars = require('handlebars');

Handlebars.registerPartial(
  'renderNestedInterface',

  `
{{~#if (isArray type)}}
Array<{{>renderNestedInterface type=type.[0] level=level}}>
{{~else if (isObject type)}}
{
{{#each type}}
{{#if (and (eq @key '_id') (eq this false))}}
{{else}}
{{indent (sum ../level 1) (wsc @key)}}: {{>renderNestedInterface type=this level=(sum ../level 1)}};
{{/if}}
{{/each}}
{{indent level '}'}}
{{else}}
{{toInterfaceType type}}
{{~/if}}
`,
);
