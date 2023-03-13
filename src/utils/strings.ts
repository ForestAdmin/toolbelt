import type * as Lodash from 'lodash';

export default class Strings {
  private readonly RESERVED_WORDS = [
    'abstract',
    'await',
    'boolean',
    'break',
    'byte',
    'case',
    'catch',
    'char',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'double',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'final',
    'finally',
    'float',
    'for',
    'function',
    'goto',
    'if',
    'implements',
    'import',
    'in',
    'instanceof',
    'int',
    'interface',
    'let',
    'long',
    'module',
    'native',
    'new',
    'null',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'short',
    'static',
    'super',
    'switch',
    'synchronized',
    'this',
    'throw',
    'throws',
    'transient',
    'true',
    'try',
    'typeof',
    'undefined',
    'var',
    'void',
    'volatile',
    'while',
    'with',
    'yield',
  ];

  private readonly lodash: typeof Lodash;

  constructor({ assertPresent, lodash }) {
    assertPresent({ lodash });

    this.lodash = lodash;
  }

  private isReservedWord(input) {
    return this.RESERVED_WORDS.includes(this.lodash.toLower(input));
  }

  pascalCase(input) {
    return this.lodash.chain(input).camelCase().upperFirst().value();
  }

  snakeCase(input) {
    return this.lodash.snakeCase(input);
  }

  camelCase(input) {
    return this.lodash.camelCase(input);
  }

  kebabCase(input) {
    return this.lodash.kebabCase(input);
  }

  transformToSafeString(input) {
    if (/^[\d]/g.exec(input)) {
      return `model${input}`;
    }
    // NOTICE: add dash to get proper snake/pascal case
    if (this.isReservedWord(input)) {
      return `model${this.lodash.upperFirst(input)}`;
    }

    return input;
  }

  transformToCamelCaseSafeString(input) {
    return this.camelCase(this.transformToSafeString(input));
  }
}
