const { inject } = require('@forestadmin/context');

function isUnderscored(fields) {
  const { assertPresent, lodash } = inject();
  assertPresent({ lodash });
  if (!fields || !fields.length) return false;

  if (fields.length === 1 && fields[0].nameColumn === 'id') return true;

  return (
    fields.every(field => field.nameColumn === lodash.snakeCase(field.nameColumn)) &&
    fields.some(field => field.nameColumn.includes('_'))
  );
}

module.exports = {
  isUnderscored,
};
