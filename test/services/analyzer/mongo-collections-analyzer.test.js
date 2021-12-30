const { ObjectId } = require('mongodb');
const {
  MongoCollectionsAnalyzer,
  mapCollection,
  reduceCollection,
} = require('../../../src/services/schema/update/analyzer/mongo-collections-analyzer');

describe('services > mongoCollectionsAnalyzer', () => {
  const makeContext = () => ({
    logger: {
      warn: jest.fn(),
    },
    assertPresent: jest.fn(),
    detectReferences: jest.fn(),
    applyReferences: jest.fn(),
    detectHasMany: jest.fn(),
    applyHasMany: jest.fn(),
    getCollectionName: jest.fn(),
    isUnderscored: jest.fn(),
    mergeAnalyzedSchemas: jest.fn(),
    isSystemCollection: jest.fn(),
    mapCollection: jest.fn(),
    reduceCollection: jest.fn(),
    makeProgressBar: jest.fn(),
  });

  describe('mapCollection', () => {
    describe('when the key is an ObjectId', () => {
      describe('when the key is not "_id"', () => {
        it('should emit the key with the good type', () => {
          expect.assertions(2);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { anObjectId: new ObjectId() };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(1);
          expect(emit).toHaveBeenLastCalledWith('anObjectId', 'Mongoose.Schema.Types.ObjectId', store);
        });
      });

      describe('when the key is "_id"', () => {
        it('should not emit the key', () => {
          expect.assertions(1);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { _id: new ObjectId() };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(0);
        });
      });
    });

    describe('when the key is a Date', () => {
      it('should emit the key with the good type', () => {
        expect.assertions(2);

        const emit = jest.fn();
        const store = Symbol('store');
        const keys = { aDate: new Date() };

        mapCollection(keys, emit, store);

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenLastCalledWith('aDate', 'Date', store);
      });
    });

    describe('when the key is a boolean', () => {
      it('should emit the key with the good type', () => {
        expect.assertions(2);

        const emit = jest.fn();
        const store = Symbol('store');
        const keys = { aBoolean: true };

        mapCollection(keys, emit, store);

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenLastCalledWith('aBoolean', 'Boolean', store);
      });
    });

    describe('when the key is a string', () => {
      it('should emit the key with the good type', () => {
        expect.assertions(2);

        const emit = jest.fn();
        const store = Symbol('store');
        const keys = { aString: 'string' };

        mapCollection(keys, emit, store);

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenLastCalledWith('aString', 'String', store);
      });
    });

    describe('when the key is a number', () => {
      describe('when the key is not equal to "__v"', () => {
        it('should emit the key with the good type', () => {
          expect.assertions(2);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { aNumber: 10 };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(1);
          expect(emit).toHaveBeenLastCalledWith('aNumber', 'Number', store);
        });
      });

      describe('when the key is equal to "__v"', () => {
        it('should not call the emit', () => {
          expect.assertions(1);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { __v: 10 };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(0);
        });
      });
    });

    describe('when the key is an array', () => {
      describe('when all items are object ids', () => {
        it('should call the emit with the good type', () => {
          expect.assertions(2);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { anObject: [ObjectId()] };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(1);
          expect(emit).toHaveBeenLastCalledWith('anObject', '[Mongoose.Schema.Types.ObjectId]', store);
        });
      });

      describe('when all items are not object ids', () => {
        it('should call the emit with the good type', () => {
          expect.assertions(2);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { anObject: [ObjectId(), 10] };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(1);
          expect(emit).toHaveBeenLastCalledWith(
            'anObject',
            { schema: ['Mongoose.Schema.Types.ObjectId', 'Number'], type: 'embedded' },
            store,
          );
        });
      });

      describe('when it is empty', () => {
        it('should not call the emit', () => {
          expect.assertions(1);

          const emit = jest.fn();
          const store = Symbol('store');
          const keys = { anObject: [] };

          mapCollection(keys, emit, store);

          expect(emit).toHaveBeenCalledTimes(0);
        });
      });
    });
  });

  describe('reduceCollection', () => {
    describe('when analyses has only embedded types', () => {
      it('should return all the schemas with the embedded type', () => {
        expect.assertions(1);

        const schema = Symbol('schema');
        const schema2 = Symbol('schema2');
        const analyses = [{ type: 'embedded', schema }, { type: 'embedded', schema: schema2 }];
        const formattedAnalysis = reduceCollection('aKey', analyses);

        expect(formattedAnalysis).toStrictEqual({ schemas: [schema, schema2], type: 'embedded' });
      });
    });

    describe('when analyses has embedded types and other types', () => {
      it('should return the schemas for the embedded type and the analysis for the other type', () => {
        expect.assertions(1);

        const schema = Symbol('schema');
        const analysis = Symbol('analysis');
        const analyses = [{ type: 'embedded', schema }, analysis];
        const formattedAnalysis = reduceCollection('aKey', analyses);

        expect(formattedAnalysis).toStrictEqual({ schemas: [schema, analysis], type: 'embedded' });
      });
    });

    describe('when analyses has not embedded types', () => {
      it('should return the first analysis', () => {
        expect.assertions(1);

        const analyses = ['String', 'Number'];
        const formattedAnalysis = reduceCollection('aKey', analyses);

        expect(formattedAnalysis).toBe('String');
      });
    });

    describe('when analyses are empty', () => {
      it('should return null', () => {
        expect.assertions(1);

        const analyses = [];
        const formattedAnalysis = reduceCollection('aKey', analyses);

        expect(formattedAnalysis).toBeNull();
      });
    });
  });

  describe('mapReduceOptions', () => {
    it('build correctly the options', () => {
      expect.assertions(1);

      const context = makeContext();
      const {
        getMongooseArraySchema,
        getMongooseEmbeddedSchema,
        getMongooseSchema,
        getMongooseTypeFromValue,
        haveSameEmbeddedType,
        hasEmbeddedTypes,
        isOfMongooseType,
      } = context;

      const analyzer = new MongoCollectionsAnalyzer(context);

      expect(analyzer.mapReduceOptions).toStrictEqual({
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
      });
    });
  });

  describe('emit', () => {
    describe('when it is a newest key', () => {
      it('should store the key with its type', () => {
        expect.assertions(1);

        const fieldsTypes = {};

        MongoCollectionsAnalyzer.emit('key1', 'String', fieldsTypes);

        expect(fieldsTypes).toStrictEqual({ key1: ['String'] });
      });
    });

    describe('when the key is already registered', () => {
      it('should store only store its type', () => {
        expect.assertions(1);

        const fieldsTypes = { key1: ['String'] };

        MongoCollectionsAnalyzer.emit('key1', 'String', fieldsTypes);

        expect(fieldsTypes).toStrictEqual({ key1: ['String', 'String'] });
      });
    });
  });

  describe('analyzeMongoCollectionRemotely', () => {
    it('should call the mapReduce method with the correct params', async () => {
      expect.assertions(7);

      const mapReduce = jest.fn().mockResolvedValue();
      const databaseConnection = {
        collection: jest.fn().mockReturnValue(
          { mapReduce },
        ),
      };
      const collectionName = 'a-collection-name';

      const analyzer = new MongoCollectionsAnalyzer(makeContext());

      const mapReduceErrorsMockReturnedValue = Symbol('error');
      const mapReduceErrorsMock = jest.fn().mockReturnValue(mapReduceErrorsMockReturnedValue);
      jest.spyOn(analyzer, 'mapReduceErrors').mockImplementation(mapReduceErrorsMock);
      analyzer.mapReduceOptions = Symbol('options');

      const aPromise = analyzer.analyzeMongoCollectionRemotely(databaseConnection, collectionName);

      expect(aPromise).toBeInstanceOf(Promise);

      expect(databaseConnection.collection).toHaveBeenCalledTimes(1);
      expect(databaseConnection.collection).toHaveBeenLastCalledWith(collectionName);

      expect(mapReduceErrorsMock).toHaveBeenCalledTimes(1);
      expect(mapReduceErrorsMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        expect.any(Function),
      );

      expect(mapReduce).toHaveBeenCalledTimes(1);
      expect(mapReduce).toHaveBeenLastCalledWith(
        analyzer.mapCollection,
        analyzer.reduceCollection,
        analyzer.mapReduceOptions,
        mapReduceErrorsMockReturnedValue,
      );
    });
  });

  describe('buildSchema', () => {
    it('should build a schema', () => {
      expect.assertions(3);
      const fields = [{ nameColumn: 'id' }, { nameColumn: 'firstName' }];

      const context = makeContext();
      const { isUnderscored } = context;

      isUnderscored.mockImplementation().mockReturnValueOnce('timestamp');
      const analyzer = new MongoCollectionsAnalyzer(context);

      const schema = analyzer.buildSchema(fields);

      expect(isUnderscored).toHaveBeenCalledTimes(1);
      expect(isUnderscored).toHaveBeenLastCalledWith(fields);
      expect(schema).toStrictEqual({
        fields,
        references: [],
        primaryKeys: ['_id'],
        options: {
          timestamps: 'timestamp',
        },
      });
    });
  });

  describe('applyRelationships', () => {
    it('should apply the references and the has many relations', async () => {
      expect.assertions(9);

      const context = makeContext();
      const {
        detectReferences, applyReferences, detectHasMany, applyHasMany,
      } = context;

      const references = Symbol('references');
      detectReferences.mockResolvedValue(references);
      const hasMany = Symbol('hasMany');
      detectHasMany.mockResolvedValue(hasMany);

      const fields = [{ nameColumn: 'id' }, { nameColumn: 'firstName' }];
      const databaseConnection = Symbol('databaseConnection');
      const collectionName = 'a-collection-name';

      const analyzer = new MongoCollectionsAnalyzer(context);
      const expectedFields = await analyzer.applyRelationships(
        databaseConnection, fields, collectionName,
      );

      expect(detectReferences).toHaveBeenCalledTimes(1);
      expect(detectReferences).toHaveBeenLastCalledWith(databaseConnection, fields, collectionName);

      expect(applyReferences).toHaveBeenCalledTimes(1);
      expect(applyReferences).toHaveBeenLastCalledWith(fields, references);

      expect(detectHasMany).toHaveBeenCalledTimes(1);
      expect(detectHasMany).toHaveBeenLastCalledWith(databaseConnection, fields, collectionName);

      expect(applyHasMany).toHaveBeenCalledTimes(1);
      expect(applyHasMany).toHaveBeenLastCalledWith(fields, hasMany);

      expect(expectedFields).toStrictEqual(fields);
    });
  });

  describe('analyzeMongoCollectionLocally', () => {
    it('should analyze the collection, returns the fields and display a log', async () => {
      expect.assertions(7);

      const collection = Symbol('collection');
      const databaseConnection = { collection: jest.fn().mockReturnValue(collection) };
      const collectionName = 'a-collection-name';

      const fieldsTypes = { _id: ['string'] };

      const analyzer = new MongoCollectionsAnalyzer(makeContext());
      jest.spyOn(analyzer, 'analyzeCollectionAndDisplayProgressBarIfIsAllow').mockImplementation(() => fieldsTypes);

      const fields = [{
        name: '_id',
        type: 'String',
      }];
      jest.spyOn(analyzer, 'getFields').mockImplementation().mockReturnValue(fields);

      const expectedFields = await analyzer.analyzeMongoCollectionLocally(
        databaseConnection, collectionName,
      );

      expect(databaseConnection.collection).toHaveBeenCalledTimes(1);
      expect(databaseConnection.collection).toHaveBeenLastCalledWith(collectionName);

      expect(analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow).toHaveBeenCalledTimes(1);
      expect(analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow)
        .toHaveBeenLastCalledWith(collection, collectionName);

      expect(analyzer.getFields).toHaveBeenCalledTimes(1);
      expect(analyzer.getFields).toHaveBeenLastCalledWith(fieldsTypes);

      expect(expectedFields).toStrictEqual(fields);
    });
  });

  describe('analyzeMongoCollectionsWithoutProgressBar', () => {
    it('should return the formatted fields', async () => {
      expect.assertions(5);

      const analyzer = new MongoCollectionsAnalyzer(makeContext());
      const analyze = Symbol('analyze');
      jest.spyOn(analyzer, 'analyzeMongoCollections').mockImplementation().mockReturnValue(analyze);

      const databaseConnection = Symbol('db');

      expect(analyzer.isDisplayProgressBar).toBe(true);

      const result = await analyzer.analyzeMongoCollectionsWithoutProgressBar(databaseConnection);

      expect(analyzer.isDisplayProgressBar).toBe(false);

      expect(analyzer.analyzeMongoCollections).toHaveBeenCalledTimes(1);
      expect(analyzer.analyzeMongoCollections).toHaveBeenLastCalledWith(databaseConnection);

      expect(result).toStrictEqual(analyze);
    });
  });

  describe('getFields', () => {
    it('should return the formatted fields', () => {
      expect.assertions(7);

      const fieldWithTypes = {
        _id: ['String', 'String', 'String'],
        account_id: ['Number', 'Number', 'Number'],
      };
      const analyzer = new MongoCollectionsAnalyzer(makeContext());
      jest.spyOn(analyzer, 'reduceCollection').mockImplementation()
        .mockReturnValueOnce('String')
        .mockReturnValueOnce('Number');
      jest.spyOn(analyzer, 'mergeField')
        .mockReturnValueOnce({ name: '_id', type: 'String' })
        .mockReturnValueOnce({ name: 'account_id', type: 'Number' });

      const expectedFields = analyzer.getFields(fieldWithTypes);

      expect(analyzer.reduceCollection).toHaveBeenCalledTimes(2);
      expect(analyzer.reduceCollection).toHaveBeenCalledWith('_id', fieldWithTypes._id);
      expect(analyzer.reduceCollection).toHaveBeenCalledWith('account_id', fieldWithTypes.account_id);

      expect(analyzer.mergeField).toHaveBeenCalledTimes(2);
      expect(analyzer.mergeField).toHaveBeenCalledWith({ _id: '_id', value: 'String' });
      expect(analyzer.mergeField).toHaveBeenCalledWith({ _id: 'account_id', value: 'Number' });

      expect(expectedFields).toStrictEqual([
        { name: '_id', type: 'String' },
        { name: 'account_id', type: 'Number' },
      ]);
    });
  });

  describe('analyzeCollectionAndDisplayProgressBarIfIsAllow', () => {
    it('should return all the fields with all the collected types', async () => {
      expect.assertions(7);

      const documentA = {};
      const documentB = {};
      const documents = [documentA, documentB];
      const toArray = jest.fn().mockResolvedValue(documents);
      const collection = {
        countDocuments: jest.fn().mockResolvedValue(50),
        find: jest.fn().mockReturnValue({ toArray }),
      };

      const context = makeContext();
      const { makeProgressBar } = context;

      const update = jest.fn();
      const tick = jest.fn();
      makeProgressBar.mockReturnValue({ update, tick });

      const analyzer = new MongoCollectionsAnalyzer(context);
      const expectedFields = await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(
        collection, 'aCollectionName',
      );

      expect(collection.countDocuments).toHaveBeenCalledTimes(1);

      expect(collection.find).toHaveBeenCalledTimes(1);
      expect(collection.find).toHaveBeenLastCalledWith(
        {},
        { minIndex: 0, limit: 50 },
      );

      expect(analyzer.mapCollection).toHaveBeenCalledTimes(documents.length);
      expect(analyzer.mapCollection).toHaveBeenCalledWith(
        documentA, MongoCollectionsAnalyzer.emit, {},
      );
      expect(analyzer.mapCollection).toHaveBeenCalledWith(
        documentB, MongoCollectionsAnalyzer.emit, {},
      );

      expect(expectedFields).toBeTruthy();
    });

    describe('when the number of document is 0', () => {
      it('should not fetch the documents', async () => {
        expect.assertions(3);

        const collection = {
          countDocuments: jest.fn().mockResolvedValue(0),
          find: jest.fn(),
        };

        const analyzer = new MongoCollectionsAnalyzer(makeContext());
        const expectedFields = await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(
          collection, 'aCollectionName',
        );

        expect(collection.countDocuments).toHaveBeenCalledTimes(1);

        expect(collection.find).toHaveBeenCalledTimes(0);

        expect(expectedFields).toStrictEqual({});
      });

      it('should not display the progress bar', async () => {
        expect.assertions(1);

        const context = makeContext();
        const { makeProgressBar } = context;

        const collection = {
          countDocuments: jest.fn().mockResolvedValue(0),
          find: jest.fn(),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);
        await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, 'aCollectionName');

        expect(makeProgressBar).toHaveBeenCalledTimes(0);
      });
    });

    describe('when the number of document is bigger than the maximum allowed', () => {
      it('should fetch the documents by chunk', async () => {
        expect.assertions(3);

        const context = makeContext();
        const { makeProgressBar } = context;

        const toArray = jest.fn().mockResolvedValue([]);
        const collection = {
          countDocuments: jest.fn().mockResolvedValue(52),
          find: jest.fn().mockReturnValue({ toArray }),
        };

        const update = jest.fn();
        const tick = jest.fn();
        makeProgressBar.mockReturnValue({ update, tick });

        const analyzer = new MongoCollectionsAnalyzer(context);
        await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, 'aCollectionName');

        // chunk 1 : 50, chunk 2 : 2
        expect(collection.find).toHaveBeenCalledTimes(2);
        expect(collection.find).toHaveBeenCalledWith({}, { minIndex: 0, limit: 50 });
        expect(collection.find).toHaveBeenCalledWith({}, { minIndex: 50, limit: 50 });
      });

      it('should display the progress bar and update it at each chunk', async () => {
        expect.assertions(6);

        const context = makeContext();
        const { makeProgressBar } = context;

        const toArray = jest.fn().mockResolvedValue([]);
        const collection = {
          countDocuments: jest.fn().mockResolvedValue(52),
          find: jest.fn().mockReturnValue({ toArray }),
        };

        const update = jest.fn();
        const tick = jest.fn();
        makeProgressBar.mockReturnValue({ update, tick });

        const analyzer = new MongoCollectionsAnalyzer(context);
        const collectionName = 'aCollectionName';
        await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, collectionName);

        const countChunks = 2;

        expect(makeProgressBar).toHaveBeenCalledTimes(1);
        expect(makeProgressBar).toHaveBeenCalledWith(
          `Analysing the **${collectionName}** collection`, countChunks,
        );

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(0);

        expect(tick).toHaveBeenCalledTimes(countChunks);
        expect(tick).toHaveBeenCalledWith();
      });
    });

    describe('when the number of document is less than the maximum allowed', () => {
      it('should fetch all the documents at one time', async () => {
        expect.assertions(2);

        const context = makeContext();
        const { makeProgressBar } = context;

        const toArray = jest.fn().mockResolvedValue([]);
        const collection = {
          countDocuments: jest.fn().mockResolvedValue(50),
          find: jest.fn().mockReturnValue({ toArray }),
        };

        const update = jest.fn();
        const tick = jest.fn();
        makeProgressBar.mockReturnValue({ update, tick });

        const analyzer = new MongoCollectionsAnalyzer(context);
        await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, 'aCollectionName');

        expect(collection.find).toHaveBeenCalledTimes(1);
        expect(collection.find).toHaveBeenCalledWith({}, { minIndex: 0, limit: 50 });
      });
    });

    describe('when it should not display the progress bar', () => {
      it('should not initialize the progress bar and update it', async () => {
        expect.assertions(3);

        const context = makeContext();
        const { makeProgressBar } = context;

        const toArray = jest.fn().mockResolvedValue([]);
        const collection = {
          countDocuments: jest.fn().mockResolvedValue(50),
          find: jest.fn().mockReturnValue({ toArray }),
        };

        const tick = jest.fn();
        const update = jest.fn();
        makeProgressBar.mockReturnValue({ update, tick });

        const analyzer = new MongoCollectionsAnalyzer(context);

        analyzer.isDisplayProgressBar = false;
        await analyzer.analyzeCollectionAndDisplayProgressBarIfIsAllow(collection, 'aCollectionName');

        expect(makeProgressBar).toHaveBeenCalledTimes(0);
        expect(tick).toHaveBeenCalledTimes(0);
        expect(update).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('analyzeMongoCollections', () => {
    describe('when there is no collection', () => {
      it('should throw an error', async () => {
        expect.assertions(1);

        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([]),
        };

        const analyzer = new MongoCollectionsAnalyzer(makeContext());
        await expect(analyzer.analyzeMongoCollections(databaseConnection))
          .rejects.toThrowErrorMatchingInlineSnapshot('"no collections found"');
      });
    });

    describe('when the collection has not name', () => {
      it('should returns an empty schema', async () => {
        expect.assertions(3);

        const context = makeContext();
        const { getCollectionName } = context;

        getCollectionName.mockImplementation().mockReturnValue(null);

        const collection = Symbol('collection');
        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([collection]),
          listCollections: jest.fn().mockReturnValue(
            { toArray: jest.fn().mockResolvedValue([]) },
          ),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);
        const schema = await analyzer.analyzeMongoCollections(databaseConnection);

        expect(analyzer.getCollectionName).toHaveBeenCalledTimes(1);
        expect(analyzer.getCollectionName).toHaveBeenLastCalledWith(collection);

        expect(schema).toStrictEqual({});
      });
    });

    describe('when the collection is a view', () => {
      it('should not generate the analyze and apply the relationships', async () => {
        expect.assertions(6);

        const context = makeContext();
        const { isSystemCollection, getCollectionName } = context;

        const collectionName = 'mainCollection';

        getCollectionName.mockImplementation().mockReturnValue(collectionName);
        isSystemCollection.mockImplementation().mockReturnValue(false);

        const collection = { name: collectionName };
        const collectionInfo = {
          options: { viewOn: 'aCollection' },
          name: collectionName,
        };

        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([collection]),
          listCollections: jest.fn().mockReturnValue(
            { toArray: jest.fn().mockResolvedValue([collectionInfo]) },
          ),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);
        jest.spyOn(analyzer, 'analyzeMongoCollectionLocally').mockImplementation();
        jest.spyOn(analyzer, 'analyzeMongoCollectionRemotely').mockImplementation();
        jest.spyOn(analyzer, 'applyRelationships').mockImplementation();

        const analysis = {};
        jest.spyOn(analyzer, 'buildSchema').mockImplementation().mockReturnValue(analysis);

        const schema = await analyzer.analyzeMongoCollections(databaseConnection);

        expect(analyzer.analyzeMongoCollectionRemotely).toHaveBeenCalledTimes(0);
        expect(analyzer.analyzeMongoCollectionLocally).toHaveBeenCalledTimes(0);

        expect(analyzer.applyRelationships).toHaveBeenCalledTimes(1);
        expect(analyzer.applyRelationships)
          .toHaveBeenCalledWith(databaseConnection, [], collectionName);

        expect(analyzer.buildSchema).toHaveBeenCalledTimes(1);

        const expectedSchema = {};
        expectedSchema[collectionName] = analysis;
        expect(schema).toStrictEqual(expectedSchema);
      });
    });

    describe('when the collection name is a system collection', () => {
      it('should returns an empty schema', async () => {
        expect.assertions(3);

        const context = makeContext();
        const { getCollectionName, isSystemCollection } = context;

        getCollectionName.mockImplementation().mockReturnValue('aSystemCollectionName');
        isSystemCollection.mockImplementation().mockReturnValue(true);

        const collection = Symbol('collection');
        const collectionInfo = {};
        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([collection]),
          listCollections: jest.fn().mockReturnValue(
            { toArray: jest.fn().mockResolvedValue([collectionInfo]) },
          ),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);
        const schema = await analyzer.analyzeMongoCollections(databaseConnection);

        expect(analyzer.isSystemCollection).toHaveBeenCalledTimes(1);
        expect(analyzer.isSystemCollection).toHaveBeenLastCalledWith(collection);

        expect(schema).toStrictEqual({});
      });
    });

    describe('when the mongodb instance support the js', () => {
      it('should run the code remotely and build the schema', async () => {
        expect.assertions(8);

        const context = makeContext();
        const { getCollectionName, isSystemCollection } = context;

        const collectionName = 'aCollectionName';
        getCollectionName.mockImplementation().mockReturnValue(collectionName);
        isSystemCollection.mockImplementation().mockReturnValue(false);

        const collection = { name: 'aName' };
        const collectionInfo = { options: {}, name: 'aName' };
        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([collection]),
          listCollections: jest.fn().mockReturnValue(
            { toArray: jest.fn().mockResolvedValue([collectionInfo]) },
          ),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);

        jest.spyOn(analyzer, 'analyzeMongoCollectionLocally').mockImplementation();
        const analysis = {};
        jest.spyOn(analyzer, 'analyzeMongoCollectionRemotely').mockImplementation()
          .mockResolvedValue(analysis);
        jest.spyOn(analyzer, 'applyRelationships').mockImplementation()
          .mockResolvedValue(analysis);

        const builtSchema = {};
        jest.spyOn(analyzer, 'buildSchema').mockImplementation().mockReturnValue(builtSchema);

        const schema = await analyzer.analyzeMongoCollections(databaseConnection);

        await expect(analyzer.analyzeMongoCollectionLocally).toHaveBeenCalledTimes(0);

        await expect(analyzer.analyzeMongoCollectionRemotely).toHaveBeenCalledTimes(1);
        await expect(analyzer.analyzeMongoCollectionRemotely)
          .toHaveBeenLastCalledWith(databaseConnection, collectionName);

        await expect(analyzer.applyRelationships).toHaveBeenCalledTimes(1);
        await expect(analyzer.applyRelationships)
          .toHaveBeenLastCalledWith(databaseConnection, analysis, collectionName);

        await expect(analyzer.buildSchema).toHaveBeenCalledTimes(1);
        await expect(analyzer.buildSchema).toHaveBeenLastCalledWith(analysis);

        await expect(schema).toStrictEqual({ aCollectionName: builtSchema });
      });
    });

    describe('when the mongodb instance does not support the js', () => {
      it('should run the code remotely and build the schema', async () => {
        expect.assertions(10);

        const context = makeContext();
        const { logger, getCollectionName, isSystemCollection } = context;

        const collection = Symbol('collection');
        const collectionInfo = { options: {}, name: 'aName' };
        const databaseConnection = {
          collections: jest.fn().mockResolvedValue([collection]),
          listCollections: jest.fn().mockReturnValue(
            { toArray: jest.fn().mockResolvedValue([collectionInfo]) },
          ),
        };

        const analyzer = new MongoCollectionsAnalyzer(context);

        const collectionName = 'aCollectionName';
        getCollectionName.mockImplementation().mockReturnValue(collectionName);
        isSystemCollection.mockImplementation().mockReturnValue(false);
        jest.spyOn(analyzer, 'analyzeMongoCollectionRemotely').mockImplementation()
          .mockResolvedValue('MapReduceError');
        const analysis = {};
        jest.spyOn(analyzer, 'analyzeMongoCollectionLocally').mockImplementation()
          .mockResolvedValue(analysis);
        jest.spyOn(analyzer, 'applyRelationships').mockImplementation()
          .mockResolvedValue(analysis);

        const builtSchema = {};
        jest.spyOn(analyzer, 'buildSchema').mockImplementation().mockReturnValue(builtSchema);

        const schema = await analyzer.analyzeMongoCollections(databaseConnection);

        expect(analyzer.analyzeMongoCollectionLocally).toHaveBeenCalledTimes(1);
        expect(analyzer.analyzeMongoCollectionLocally)
          .toHaveBeenLastCalledWith(databaseConnection, collectionName);

        expect(analyzer.analyzeMongoCollectionRemotely).toHaveBeenCalledTimes(1);
        expect(analyzer.analyzeMongoCollectionRemotely)
          .toHaveBeenLastCalledWith(databaseConnection, collectionName);

        expect(analyzer.applyRelationships).toHaveBeenCalledTimes(1);
        expect(analyzer.applyRelationships)
          .toHaveBeenLastCalledWith(databaseConnection, analysis, collectionName);

        expect(analyzer.buildSchema).toHaveBeenCalledTimes(1);
        expect(analyzer.buildSchema).toHaveBeenLastCalledWith(analysis);

        expect(logger.warn).toHaveBeenCalledTimes(1);

        expect(schema).toStrictEqual({ aCollectionName: builtSchema });
      });

      describe('when there are several collections', () => {
        it('should try to run the js code remotely only one time', async () => {
          expect.assertions(2);

          const context = makeContext();
          const { isSystemCollection, getCollectionName } = context;

          isSystemCollection.mockImplementation().mockReturnValue(false);
          const collection = Symbol('collection');
          const collectionInfo = { options: {}, name: 'aName' };
          const collections = [collection, collection];
          const collectionsInfo = [collectionInfo, collectionInfo];
          const databaseConnection = {
            collections: jest.fn().mockResolvedValue(collections),
            listCollections: jest.fn().mockReturnValue(
              { toArray: jest.fn().mockResolvedValue(collectionsInfo) },
            ),
          };

          const analyzer = new MongoCollectionsAnalyzer(context);

          const collectionName = 'aCollectionName';
          getCollectionName.mockImplementation().mockReturnValue(collectionName);
          jest.spyOn(analyzer, 'analyzeMongoCollectionRemotely').mockImplementation()
            .mockResolvedValue('MapReduceError');
          jest.spyOn(analyzer, 'analyzeMongoCollectionLocally').mockImplementation();
          jest.spyOn(analyzer, 'applyRelationships').mockImplementation();

          const builtSchema = {};
          jest.spyOn(analyzer, 'buildSchema').mockImplementation().mockReturnValue(builtSchema);

          await analyzer.analyzeMongoCollections(databaseConnection);

          expect(analyzer.analyzeMongoCollectionRemotely).toHaveBeenCalledTimes(1);
          expect(analyzer.analyzeMongoCollectionLocally)
            .toHaveBeenCalledTimes(collections.length);
        });
      });
    });
  });

  describe('mergeField', () => {
    describe('when it is not a embedded field', () => {
      it('should format the field', () => {
        expect.assertions(1);

        const analyzer = new MongoCollectionsAnalyzer(makeContext());

        const field = {
          _id: 'columnName',
          value: 'String',
        };

        expect(analyzer.mergeField(field)).toStrictEqual(
          {
            name: field._id,
            type: field.value,
          },
        );
      });
    });

    describe('when it is a embedded field', () => {
      describe('when there are several schemas', () => {
        it('should format the field and merge the schemas', () => {
          expect.assertions(3);

          const context = makeContext();
          const { mergeAnalyzedSchemas } = context;

          const mergedSchema = {};
          mergeAnalyzedSchemas.mockImplementation().mockReturnValue(mergedSchema);

          const analyzer = new MongoCollectionsAnalyzer(context);

          const schemas = [];
          const field = {
            _id: 'columnName',
            value: { type: 'embedded', schemas },
          };
          const mergedField = analyzer.mergeField(field);

          expect(analyzer.mergeAnalyzedSchemas).toHaveBeenCalledTimes(1);
          expect(analyzer.mergeAnalyzedSchemas).toHaveBeenLastCalledWith(schemas);
          expect(mergedField).toStrictEqual(
            {
              name: field._id,
              type: mergedSchema,
            },
          );
        });
      });

      describe('when there is a schema', () => {
        it('should format the field and merge the schema', () => {
          expect.assertions(3);

          const analyzer = new MongoCollectionsAnalyzer(makeContext());

          const mergedSchema = {};
          jest.spyOn(analyzer, 'mergeAnalyzedSchemas').mockImplementation().mockReturnValue(
            mergedSchema,
          );
          const schema = {};
          const field = {
            _id: 'columnName',
            value: { type: 'embedded', schema },
          };
          const mergedField = analyzer.mergeField(field);

          expect(analyzer.mergeAnalyzedSchemas).toHaveBeenCalledTimes(1);
          expect(analyzer.mergeAnalyzedSchemas).toHaveBeenLastCalledWith([schema]);
          expect(mergedField).toStrictEqual(
            {
              name: field._id,
              type: mergedSchema,
            },
          );
        });
      });
    });
  });

  describe('mapReduceErrors', () => {
    describe('when there is no error', () => {
      it('should merge the field for all the results', async () => {
        expect.assertions(6);

        const analyzer = new MongoCollectionsAnalyzer(makeContext());

        const resolve = jest.fn();
        const reject = jest.fn();

        const callback = analyzer.mapReduceErrors(resolve, reject);

        const mergedFieldA = {};
        const mergedFieldB = {};
        jest.spyOn(analyzer, 'mergeField').mockImplementation()
          .mockReturnValueOnce(mergedFieldA)
          .mockReturnValueOnce(mergedFieldB);

        const fieldA = {};
        const fieldB = {};
        const fields = [fieldA, fieldB];
        const noError = null;
        callback(noError, fields);

        expect(analyzer.mergeField).toHaveBeenCalledTimes(fields.length);
        expect(analyzer.mergeField).toHaveBeenCalledWith(fieldA);
        expect(analyzer.mergeField).toHaveBeenCalledWith(fieldB);

        expect(resolve).toHaveBeenCalledTimes(1);
        expect(reject).toHaveBeenCalledTimes(0);

        expect(resolve).toHaveBeenLastCalledWith([mergedFieldA, mergedFieldB]);
      });
    });

    describe('when there is an error', () => {
      describe('when there is a message starting by CMD_NOT_ALLOWED', () => {
        it('should resolve an error', async () => {
          expect.assertions(2);

          const analyzer = new MongoCollectionsAnalyzer(makeContext());

          const resolve = jest.fn();
          const reject = jest.fn();

          const callback = analyzer.mapReduceErrors(resolve, reject);

          const error = { message: 'CMD_NOT_ALLOWED' };
          callback(error, null);

          expect(resolve).toHaveBeenCalledTimes(1);
          expect(resolve).toHaveBeenLastCalledWith('MapReduceError');
        });
      });

      describe('when there is a message starting by MapReduce', () => {
        it('should resolve an error and display a log', async () => {
          expect.assertions(2);

          const analyzer = new MongoCollectionsAnalyzer(makeContext());

          const resolve = jest.fn();
          const reject = jest.fn();

          const callback = analyzer.mapReduceErrors(resolve, reject);

          const error = { message: 'MapReduce' };
          callback(error, null);

          expect(resolve).toHaveBeenCalledTimes(1);
          expect(resolve).toHaveBeenLastCalledWith('MapReduceError');
        });
      });

      describe('when there is "CommandNotSupportedOnView" codeName', () => {
        it('should resolve an error', async () => {
          expect.assertions(2);

          const context = makeContext();
          const { logger } = context;
          const analyzer = new MongoCollectionsAnalyzer(context);

          const resolve = jest.fn();
          const reject = jest.fn();

          const callback = analyzer.mapReduceErrors(resolve, reject, 'collectionName', logger);

          const error = { codeName: 'CommandNotSupportedOnView' };
          callback(error, null);

          expect(resolve).toHaveBeenCalledTimes(1);
          expect(resolve).toHaveBeenLastCalledWith([]);
        });
      });

      describe('when there is a lambda error', () => {
        it('should reject an error', async () => {
          expect.assertions(2);

          const context = makeContext();
          const { logger } = context;
          const analyzer = new MongoCollectionsAnalyzer(context);

          const resolve = jest.fn();
          const reject = jest.fn();

          const callback = analyzer.mapReduceErrors(resolve, reject, 'collectionName', logger);

          const lambdaError = {};
          callback(lambdaError, null);

          expect(reject).toHaveBeenCalledTimes(1);
          expect(reject).toHaveBeenLastCalledWith(lambdaError);
        });
      });
    });
  });
});
