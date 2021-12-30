const ProgressBar = require('progress');
const {
  detectReferences,
  applyReferences,
} = require('../services/schema/update/analyzer/mongo-references-analyzer');

const {
  detectHasMany,
  applyHasMany,
} = require('../services/schema/update/analyzer/mongo-hasmany-analyzer');

const { isUnderscored } = require('../utils/fields');

const {
  getMongooseTypeFromValue,
  isOfMongooseType,
} = require('../utils/mongo-primitive-type');

const {
  isSystemCollection,
  getCollectionName,
} = require('../utils/mongo-collections');

const {
  getMongooseArraySchema,
  getMongooseEmbeddedSchema,
  getMongooseSchema,
  haveSameEmbeddedType,
  hasEmbeddedTypes,
  mergeAnalyzedSchemas,
} = require('../services/schema/update/analyzer/mongo-embedded-analyzer');

const {
  MongoCollectionsAnalyzer, mapCollection, reduceCollection,
} = require('../services/schema/update/analyzer/mongo-collections-analyzer');

function makeProgressBar(message, total) {
  return new ProgressBar(`${message} [:bar] :percent`, { total, width: 50 });
}

/* eslint-disable global-require */
module.exports = (plan) => plan
  .addModule('path', () => require('path'))
  .addFunction('mapCollection', mapCollection, { private: true })
  .addFunction('reduceCollection', reduceCollection, { private: true })
  .addFunction('detectReferences', detectReferences, { private: true })
  .addFunction('applyReferences', applyReferences, { private: true })
  .addFunction('detectHasMany', detectHasMany, { private: true })
  .addFunction('applyHasMany', applyHasMany, { private: true })
  .addFunction('isUnderscored', isUnderscored, { private: true })
  .addFunction('getMongooseTypeFromValue', getMongooseTypeFromValue, { private: true })
  .addFunction('isOfMongooseType', isOfMongooseType, { private: true })
  .addFunction('getMongooseArraySchema', getMongooseArraySchema, { private: true })
  .addFunction('getMongooseEmbeddedSchema', getMongooseEmbeddedSchema, { private: true })
  .addFunction('getMongooseSchema', getMongooseSchema, { private: true })
  .addFunction('haveSameEmbeddedType', haveSameEmbeddedType, { private: true })
  .addFunction('hasEmbeddedTypes', hasEmbeddedTypes, { private: true })
  .addFunction('mergeAnalyzedSchemas', mergeAnalyzedSchemas, { private: true })
  .addFunction('isSystemCollection', isSystemCollection, { private: true })
  .addFunction('getCollectionName', getCollectionName, { private: true })
  .addFunction('makeProgressBar', makeProgressBar, { private: true })
  .addFunction('sequelizeAnalyzer', require('../services/schema/update/analyzer/sequelize-tables-analyzer'))
  .addUsingClass('spinnerUi', () => require('../services/spinner'))
  .addUsingClass('mongoAnalyzer', MongoCollectionsAnalyzer)
  .addUsingClass('databaseAnalyzer', () => require('../services/schema/update/analyzer/database-analyzer'));
