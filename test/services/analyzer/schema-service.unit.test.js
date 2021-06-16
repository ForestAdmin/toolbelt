const SchemaService = require('../../../src/services/schema/schema-service');

const makeContext = () => ({
  assertPresent: jest.fn(),
  database: {},
  databaseAnalyzer: {},
  dumper: {
    checkLianaCompatiblityForUpdate: jest.fn(),
  },
  env: {},
  errorHandler: {
    handle: jest.fn(),
  },
  fs: {},
  logger: {},
  path: {},
  spinner: {},
});

describe('schemaService', () => {
  it('constructor', () => {
    expect.assertions(1);
    const context = makeContext();
    // eslint-disable-next-line no-new
    new SchemaService(context);
    const { assertPresent, ...rest } = context;
    expect(assertPresent).toHaveBeenCalledWith(rest);
  });
  describe('update method', () => {
    it('should call _update', async () => {
      expect.assertions(1);
      const options = Symbol('options');
      const context = makeContext();
      const schemaService = new SchemaService(context);
      jest.spyOn(schemaService, '_update');

      await schemaService.update(options);

      expect(schemaService._update).toHaveBeenCalledWith(options);
    });
    it('should pass error to errorHandler', async () => {
      expect.assertions(1);
      const options = Symbol('options');
      const error = Symbol('error');
      const context = makeContext();
      const { errorHandler } = context;
      const schemaService = new SchemaService(context);
      jest.spyOn(schemaService, '_update').mockImplementation(() => { throw error; });

      await schemaService.update(options);

      expect(errorHandler.handle).toHaveBeenCalledWith(error);
    });
  });
  describe('_update method', () => {
    it('should orchestrate an update', async () => {
      expect.assertions(7);
      const isUpdate = Symbol('isUpdate');
      const outputDirectory = Symbol('outputDirectory');
      const dbSchema = Symbol('dbSchema');
      const dbConfigPath = Symbol('dbConfigPath');
      const databasesConfig = Symbol('databasesConfig');
      const databasesConnection = Symbol('databasesConnection');
      const databasesSchema = [Symbol('databasesSchema')];
      const useMultiDatabase = false;
      const context = makeContext();
      const { dumper } = context;

      const schemaService = new SchemaService(context);
      jest.spyOn(schemaService, '_assertOutputDirectory').mockImplementation(() => {});
      jest.spyOn(schemaService, '_getDatabasesConfig').mockReturnValue(databasesConfig);
      jest.spyOn(schemaService, '_connectToDatabases').mockResolvedValue(databasesConnection);
      jest.spyOn(schemaService, '_analyzeDatabases').mockResolvedValue(databasesSchema);
      jest.spyOn(schemaService, '_dumpSchemas').mockImplementation(async () => {});
      jest.spyOn(schemaService, '_warnIfSingleToMulti').mockImplementation(() => {});

      await schemaService._update({
        isUpdate, outputDirectory, dbSchema, dbConfigPath,
      });

      expect(dumper.checkLianaCompatiblityForUpdate).toHaveBeenCalledWith();
      expect(schemaService._assertOutputDirectory).toHaveBeenCalledWith(outputDirectory);
      expect(schemaService._getDatabasesConfig).toHaveBeenCalledWith(dbConfigPath);
      expect(schemaService._connectToDatabases).toHaveBeenCalledWith(databasesConfig);
      expect(schemaService._analyzeDatabases).toHaveBeenCalledWith(databasesConnection, dbSchema);
      expect(schemaService._dumpSchemas)
        .toHaveBeenCalledWith(databasesSchema, outputDirectory, isUpdate, useMultiDatabase);
      expect(schemaService._warnIfSingleToMulti)
        .toHaveBeenCalledWith(outputDirectory, useMultiDatabase);
    });
  });
});
