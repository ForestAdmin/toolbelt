const P = require('bluebird');
const { ObjectId } = require('mongodb');

const EmptyDatabaseError = require('../../../../errors/database/empty-database-error');

const {
  getMongooseSchema,
  hasEmbeddedTypes,
} = require('../../../../services/schema/update/analyzer/mongo-embedded-analyzer');

const MAP_REDUCE_ERROR_STRING = 'MapReduceError';

// NOTICE: This code runs on the MongoDB side (mapReduce feature) or locally
//         when the the JS is disabled.
//         The supported JS version is not the same than elsewhere.
//         The code used here must work with MongoDB lower version supported.
/* eslint-disable vars-on-top, no-var, no-undef, no-restricted-syntax,
                  sonarjs/cognitive-complexity, no-use-before-define */
/* istanbul ignore next */
function mapCollection(keys = this, emitFunction, store) {
  // this block is to inject the emit function when this code is running locally
  var emitAction;
  if (emitFunction && store) {
    emitAction = function emit(key, value) {
      emitFunction(key, value, store);
    };
  } else {
    // when the emit is defined by mongodb
    emitAction = emit;
  }

  function allItemsAreObjectIDs(array) {
    if (!array.length) return false;
    var itemToCheckCount = array.length > 3 ? 3 : array.length;
    var arrayOfObjectIDs = true;
    for (var i = 0; i < itemToCheckCount; i += 1) {
      if (!(array[i] instanceof ObjectId)) {
        arrayOfObjectIDs = false;
        break;
      }
    }
    return arrayOfObjectIDs;
  }

  for (var key in keys) {
    if (keys[key] instanceof ObjectId && key !== '_id') {
      emitAction(key, 'Mongoose.Schema.Types.ObjectId');
    } else if (keys[key] instanceof Date) {
      emitAction(key, 'Date');
    } else if (typeof keys[key] === 'boolean') {
      emitAction(key, 'Boolean');
    } else if (typeof keys[key] === 'string') {
      emitAction(key, 'String');
    } else if (typeof keys[key] === 'number' && key !== '__v') {
      emitAction(key, 'Number');
    } else if (typeof keys[key] === 'object') {
      if (Array.isArray(keys[key]) && allItemsAreObjectIDs(keys[key])) {
        emitAction(key, '[Mongoose.Schema.Types.ObjectId]');
      } else if (key !== '_id') {
        var analysis = getMongooseSchema(keys[key]);
        if (analysis) {
          // Notice: Wrap the analysis of embedded in a recognizable object for further treatment
          emitAction(key, { type: 'embedded', schema: analysis });
        }
      }
    }
  }
}
/* eslint-enable */

/* istanbul ignore next */
function reduceCollection(key, analyses) {
  if (hasEmbeddedTypes(analyses)) {
    const formattedAnalysis = { type: 'embedded', schemas: [] };
    analyses.forEach((analysis) => {
      if (analysis.type === 'embedded') {
        formattedAnalysis.schemas.push(analysis.schema);
      } else {
        formattedAnalysis.schemas.push(analysis);
      }
    });
    return formattedAnalysis;
  }

  return analyses.length ? analyses[0] : null;
}

/* eslint-disable no-shadow */
class MongoCollectionsAnalyzer {
  constructor({
    assertPresent, logger, detectReferences,
    applyReferences, detectHasMany, applyHasMany,
    isUnderscored, getMongooseTypeFromValue,
    isOfMongooseType, getMongooseArraySchema,
    getMongooseEmbeddedSchema, getMongooseSchema,
    haveSameEmbeddedType, hasEmbeddedTypes,
    mergeAnalyzedSchemas, isSystemCollection,
    getCollectionName, mapCollection, reduceCollection,
    makeProgressBar,
  }) {
    assertPresent({
      logger,
      detectReferences,
      applyReferences,
      detectHasMany,
      applyHasMany,
      isUnderscored,
      getMongooseTypeFromValue,
      isOfMongooseType,
      getMongooseArraySchema,
      getMongooseEmbeddedSchema,
      getMongooseSchema,
      haveSameEmbeddedType,
      hasEmbeddedTypes,
      mergeAnalyzedSchemas,
      isSystemCollection,
      getCollectionName,
      mapCollection,
      reduceCollection,
      makeProgressBar,
    });

    this.logger = logger;
    this.detectReferences = detectReferences;
    this.applyReferences = applyReferences;
    this.detectHasMany = detectHasMany;
    this.applyHasMany = applyHasMany;
    this.isUnderscored = isUnderscored;
    this.getCollectionName = getCollectionName;
    this.isSystemCollection = isSystemCollection;
    this.mergeAnalyzedSchemas = mergeAnalyzedSchemas;
    this.mapCollection = mapCollection;
    this.reduceCollection = reduceCollection;
    this.makeProgressBar = makeProgressBar;

    this.isDisplayProgressBar = true;
    this.mapReduceOptions = {
      out: { inline: 1 },
      limit: 100,
      scope: {
        getMongooseArraySchema,
        getMongooseEmbeddedSchema,
        getMongooseSchema,
        getMongooseTypeFromValue,
        haveSameEmbeddedType,
        hasEmbeddedTypes,
        isOfMongooseType,
      },
    };
  }

  mergeField(field) {
    if (field.value && field.value.type === 'embedded') {
      const schemas = field.value.schemas ? field.value.schemas : [field.value.schema];
      const mergedSchema = this.mergeAnalyzedSchemas(schemas);

      return {
        name: field._id,
        type: mergedSchema,
      };
    }
    return {
      name: field._id,
      type: field.value,
    };
  }

  mapReduceErrors(resolve, reject) {
    return (err, results) => {
      if (err) {
        if (err.message && (err.message.startsWith('CMD_NOT_ALLOWED') || err.message.startsWith('MapReduce'))) {
          return resolve(MAP_REDUCE_ERROR_STRING);
        }
        if (err.codeName && err.codeName === 'CommandNotSupportedOnView') {
          // NOTICE: Silently ignore views errors (e.g do not import views).
          //         See: https://github.com/ForestAdmin/lumber/issues/265
          return resolve([]);
        }
        return reject(err);
      }

      return resolve(results.map((result) => this.mergeField(result)));
    };
  }

  static emit(attributeName, attributesType, fieldsTypes) {
    if (fieldsTypes[attributeName]) {
      fieldsTypes[attributeName].push(attributesType);
    } else {
      fieldsTypes[attributeName] = [attributesType];
    }
  }

  getFields(fieldWithTypes) {
    const keys = Object.keys(fieldWithTypes);
    return keys.reduce((fields, key) => {
      const field = this.mergeField({
        _id: key,
        value: this.reduceCollection(key, fieldWithTypes[key]),
      });
      fields.push(field);
      return fields;
    }, []);
  }

  // M0 free clusters and M2/M5 shared clusters do not support server-side JavaScript.
  // Also, JS can be disabled on the mongodb instance.
  // https://docs.atlas.mongodb.com/reference/free-shared-limitations/
  // https://docs.mongodb.com/manual/core/server-side-javascript/
  async analyzeMongoCollectionLocally(databaseConnection, collectionName) {
    const collection = databaseConnection.collection(collectionName);
    const analyze = await this.analyzeCollectionAndDisplayProgressBarIfIsAllow(
      collection, collectionName,
    );
    return this.getFields(analyze);
  }

  analyzeMongoCollectionRemotely(databaseConnection, collectionName) {
    return new Promise((resolve, reject) => {
      databaseConnection.collection(collectionName).mapReduce(
        this.mapCollection,
        this.reduceCollection,
        this.mapReduceOptions,
        this.mapReduceErrors(resolve, reject),
      );
    });
  }

  buildSchema(fields) {
    return {
      fields,
      references: [],
      primaryKeys: ['_id'],
      options: {
        timestamps: this.isUnderscored(fields),
      },
    };
  }

  async applyRelationships(databaseConnection, fields, collectionName) {
    const references = await this.detectReferences(databaseConnection, fields, collectionName);
    this.applyReferences(fields, references);
    const hasMany = await this.detectHasMany(databaseConnection, fields, collectionName);
    this.applyHasMany(fields, hasMany);
    return fields;
  }

  fetchByChunkFunction(collection, numberOfDocumentAllowed) {
    return async (fieldsTypes, index) => {
      const minIndex = index * numberOfDocumentAllowed;
      const options = { minIndex, limit: numberOfDocumentAllowed };
      const documents = await collection.find({}, options).toArray();
      documents.map((document) =>
        this.mapCollection(document, MongoCollectionsAnalyzer.emit, fieldsTypes));
      return fieldsTypes;
    };
  }

  async analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, collectionName) {
    const countDocuments = await collection.countDocuments();
    if (countDocuments === 0) {
      return {};
    }

    const numberOfDocumentAllowed = 50;
    const countIterations = Math.ceil(countDocuments / numberOfDocumentAllowed);

    let fetchFunction = this.fetchByChunkFunction(collection, numberOfDocumentAllowed);
    if (this.isDisplayProgressBar) {
      const bar = this.makeProgressBar(
        `Analysing the **${collectionName}** collection`,
        countIterations,
      );
      bar.update(0);

      fetchFunction = async (fieldTypes, index) => {
        const wrapper = this.fetchByChunkFunction(collection, numberOfDocumentAllowed);
        await wrapper(fieldTypes, index);
        bar.tick();
        return fieldTypes;
      };
    }

    const iterations = [...Array(countIterations).keys()];
    return P.reduce(iterations, fetchFunction, {});
  }

  async analyzeMongoCollectionsWithoutProgressBar(databaseConnection) {
    this.isDisplayProgressBar = false;
    return this.analyzeMongoCollections(databaseConnection);
  }

  async analyzeMongoCollections(databaseConnection) {
    const collections = await databaseConnection.collections();
    if (collections.length === 0) {
      throw new EmptyDatabaseError('no collections found', {
        orm: 'mongoose',
        dialect: 'mongodb',
      });
    }
    const collectionsInfos = await databaseConnection.listCollections().toArray();
    const isView = (name) => collectionsInfos.find(
      (info) => !!info.options.viewOn && name === info.name,
    );

    let isMongodbInstanceSupportJs = true;
    return P.reduce(collections, async (schema, collection) => {
      const collectionName = this.getCollectionName(collection);

      // Ignore system collections and collection without a valid name.
      if (!collectionName || this.isSystemCollection(collection)) {
        return schema;
      }
      let analysis = [];
      if (isMongodbInstanceSupportJs && !isView(collectionName)) {
        analysis = await this.analyzeMongoCollectionRemotely(databaseConnection, collectionName);
        if (analysis === MAP_REDUCE_ERROR_STRING) {
          isMongodbInstanceSupportJs = false;
          this.logger.warn('The analyze is running locally instead of in the db instance because your instance does not support javascript.'
          + ' This action can takes a bit of time because it fetches all the collections.');
        }
      }

      if (!isMongodbInstanceSupportJs && !isView(collectionName)) {
        analysis = await this.analyzeMongoCollectionLocally(databaseConnection, collectionName);
      }

      analysis = await this.applyRelationships(databaseConnection, analysis, collectionName);
      schema[collectionName] = this.buildSchema(analysis);
      return schema;
    }, {});
  }
}

module.exports = { MongoCollectionsAnalyzer, mapCollection, reduceCollection };
