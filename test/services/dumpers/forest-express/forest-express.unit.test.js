const chalk = require('chalk');

const Dumper = require('../../../../src/services/dumpers/forest-express');
const InvalidForestCLIProjectStructureError = require('../../../../src/errors/dumper/invalid-forest-cli-project-structure-error');
const IncompatibleLianaForUpdateError = require('../../../../src/errors/dumper/incompatible-liana-for-update-error');

const SequelizeMock = {
  DataTypes: {},
};

const ABSOLUTE_PROJECT_PATH = '/absolute/project/path';
const RELATIVE_FILE_PATH = 'some/folder/relative-file.js';

function createDumper(contextOverride = {}) {
  return new Dumper({
    assertPresent: jest.fn(),
    constants: {
      CURRENT_WORKING_DIRECTORY: ABSOLUTE_PROJECT_PATH,
    },
    Sequelize: SequelizeMock,
    chalk,
    mkdirp: () => {},
    isLinuxOs: false,
    buildDatabaseUrl: jest.fn(({ dbConnectionUrl }) => dbConnectionUrl),
    ...contextOverride,
  });
}

describe('services > dumper (unit)', () => {
  describe('writeFile', () => {
    const makeContextOverrides = ({ existsSync }) => ({
      logger: {
        log: jest.fn(),
      },
      fs: {
        writeFileSync: jest.fn(),
        existsSync: jest.fn().mockReturnValue(existsSync),
      },
    });

    describe('when file does not exists', () => {
      it('should call writeFileSync to write the file', () => {
        expect.assertions(2);

        const context = makeContextOverrides({ existsSync: false });
        const dumper = createDumper(context);
        dumper.projectPath = '';
        dumper.writeFile(RELATIVE_FILE_PATH, 'content');

        expect(context.fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(`/${RELATIVE_FILE_PATH}`, 'content');
      });

      it('should call the logger to display a create log message', () => {
        expect.assertions(2);

        const context = makeContextOverrides({ existsSync: false });
        createDumper(context).writeFile(RELATIVE_FILE_PATH, 'content');

        expect(context.logger.log).toHaveBeenCalledTimes(1);
        expect(context.logger.log).toHaveBeenCalledWith(
          `  ${chalk.green('create')} ${RELATIVE_FILE_PATH}`,
        );
      });
    });

    describe('when file exists', () => {
      it('should not write the file', () => {
        expect.assertions(1);

        const context = makeContextOverrides({ existsSync: true });
        createDumper(context).writeFile(RELATIVE_FILE_PATH, 'content');

        expect(context.fs.writeFileSync).not.toHaveBeenCalled();
      });

      it('should call the logger to display a skip log message', () => {
        expect.assertions(2);

        const context = makeContextOverrides({ existsSync: true });
        createDumper(context).writeFile(RELATIVE_FILE_PATH, 'content');

        expect(context.logger.log).toHaveBeenCalledTimes(1);
        expect(context.logger.log).toHaveBeenCalledWith(
          `  ${chalk.yellow('skip')} ${RELATIVE_FILE_PATH} - already exists.`,
        );
      });
    });
  });

  describe('copyHandleBarsTemplate', () => {
    const makeContextOverrides = () => ({
      Handlebars: {
        compile: () => jest.fn().mockReturnValue('content'),
      },
      fs: {
        readFileSync: jest.fn(),
      },
    });

    describe('when context is provided', () => {
      it('should call writeFile with computed parameters', () => {
        expect.assertions(2);

        const context = makeContextOverrides();
        const dumper = createDumper(context);
        const writeFileSpy = jest.spyOn(dumper, 'writeFile').mockImplementation(() => {});
        dumper.copyHandleBarsTemplate('from.js', 'to.js', { myVar: 'value' });

        expect(writeFileSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSpy).toHaveBeenCalledWith('to.js', 'content');
      });
    });
  });

  describe('writePackageJson', () => {
    it('should call write file with a valid package.json file content', () => {
      expect.assertions(6);

      const dumper = createDumper({});
      const writeFileSpy = jest.spyOn(dumper, 'writeFile').mockImplementation(() => {});
      dumper.writePackageJson('none', 'test');

      const fileContent = writeFileSpy.mock.calls[0][1];
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(() => JSON.parse(fileContent)).not.toThrow();

      const parsedPackageJson = JSON.parse(fileContent);

      expect(parsedPackageJson.name).toBe('test');
      expect(parsedPackageJson.version).toBe('0.0.1');
      expect(parsedPackageJson.private).toBe(true);
      expect(parsedPackageJson.scripts).toStrictEqual({ start: 'node ./server.js' });
    });

    describe('with specific database dialect', () => {
      const getPackageJSONContentFromDialect = dbDialect => {
        const dumper = createDumper({});
        const writeFileSpy = jest.spyOn(dumper, 'writeFile').mockImplementation(() => {});
        dumper.writePackageJson(dbDialect, 'test');

        return writeFileSpy.mock.calls[0][1];
      };

      it('undefined: it should not add any dbs connector', () => {
        expect.assertions(4);

        const packageJson = getPackageJSONContentFromDialect(undefined);

        expect(packageJson).not.toContain('pg');
        expect(packageJson).not.toContain('mysql2');
        expect(packageJson).not.toContain('tedious');
        expect(packageJson).not.toContain('mongoose');
      });

      it('postgres: it should add pg dependency', () => {
        expect.assertions(1);

        expect(getPackageJSONContentFromDialect('postgres')).toContain('pg');
      });

      it('mysql: it should add mysql2 dependency', () => {
        expect.assertions(1);

        expect(getPackageJSONContentFromDialect('mysql')).toContain('mysql2');
      });

      it('mssql: it should add tedious dependency', () => {
        expect.assertions(1);

        expect(getPackageJSONContentFromDialect('mssql')).toContain('tedious');
      });

      it('mongodb: it should add mongoose dependency', () => {
        expect.assertions(1);

        expect(getPackageJSONContentFromDialect('mongodb')).toContain('mongoose');
      });
    });
  });

  describe('tableToFilename', () => {
    it('should return a kebab case version of the given parameter', () => {
      expect.assertions(3);

      expect(Dumper.tableToFilename('test')).toBe('test');
      expect(Dumper.tableToFilename('testSomething')).toBe('test-something');
      expect(Dumper.tableToFilename('test_something_else')).toBe('test-something-else');
    });
  });

  describe('isDatabaseLocal', () => {
    it('should return true for a config referring to a database hosted locally', () => {
      expect.assertions(1);

      const dumper = createDumper({});

      const dbConnectionUrl = 'mongodb+srv://root:password@localhost/forest';

      expect(dumper.isDatabaseLocal({ dbConnectionUrl })).toBe(true);
    });

    it('should return false for a config referring to a database not hosted locally', () => {
      expect.assertions(1);

      const dumper = createDumper({});
      const dbConnectionUrl = 'mongodb+srv://root:password@somewhere.intheworld.com/forest';

      expect(dumper.isDatabaseLocal({ dbConnectionUrl })).toBe(false);
    });
  });

  describe('isLocalUrl', () => {
    it('should return true for a local url', () => {
      expect.assertions(1);

      expect(Dumper.isLocalUrl('http://localhost')).toBe(true);
    });

    it('should return false for not local url', () => {
      expect.assertions(1);

      expect(Dumper.isLocalUrl('http://somewhere.else.intheworld.com')).toBe(false);
    });
  });

  describe('getApplicationUrl', () => {
    describe('when no protocol is specified', () => {
      it('should prefix the host name with http://', () => {
        expect.assertions(1);

        const dumper = createDumper();

        expect(dumper.getApplicationUrl('somewhere.not.local.com')).toBe(
          'http://somewhere.not.local.com',
        );
      });
    });

    describe('when https? protocol is specified', () => {
      it('should append the port to the given hostname for local application url', () => {
        expect.assertions(1);

        const dumper = createDumper();

        expect(dumper.getApplicationUrl('http://localhost', '1234')).toBe('http://localhost:1234');
      });

      it('should return the appHostname already defined', () => {
        expect.assertions(1);

        const dumper = createDumper();

        expect(dumper.getApplicationUrl('https://somewhere.com')).toBe('https://somewhere.com');
      });
    });
  });

  describe('writeDotEnv', () => {
    const config = {
      dbConfig: {
        dbConnectionUrl: 'mongodb://root:password@localhost:27017/forest',
        dbSsl: true,
      },
      appConfig: {
        appHostname: 'localhost',
      },
      forestEnvSecret: 'someEnvSecret',
      forestAuthSecret: 'someAuthSecret',
    };

    describe('on a linux based os', () => {
      it('should compute the handlebars context from the given config with no dockerDatabaseUrl', () => {
        expect.assertions(2);

        const dumper = createDumper({ isLinuxOs: true });
        dumper.port = 3310;
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeDotEnv(config);

        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledTimes(1);
        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('env.hbs', '.env', {
          databaseUrl: config.dbConfig.dbConnectionUrl,
          ssl: config.dbConfig.dbSsl,
          dbSchema: undefined,
          hostname: config.appConfig.appHostname,
          port: 3310,
          forestEnvSecret: config.forestEnvSecret,
          forestAuthSecret: config.forestAuthSecret,
          hasDockerDatabaseUrl: false,
          applicationUrl: 'http://localhost:3310',
        });
      });
    });

    describe('on a non-linux based os', () => {
      it('should compute the handlebars context from the given config with a dockerDatabaseUrl', () => {
        expect.assertions(2);

        const dumper = createDumper();
        dumper.port = 3310;
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeDotEnv(config);

        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledTimes(1);
        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('env.hbs', '.env', {
          databaseUrl: config.dbConfig.dbConnectionUrl,
          ssl: config.dbConfig.dbSsl,
          dbSchema: undefined,
          dockerDatabaseUrl: 'mongodb://root:password@host.docker.internal:27017/forest',
          hostname: config.appConfig.appHostname,
          port: 3310,
          forestEnvSecret: config.forestEnvSecret,
          forestAuthSecret: config.forestAuthSecret,
          hasDockerDatabaseUrl: true,
          applicationUrl: 'http://localhost:3310',
        });
      });
    });
  });

  describe('writeDockerfile', () => {
    it('should call the copyHandleBarsTemplate with an empty context', () => {
      expect.assertions(1);

      const dumper = createDumper();
      const copyHandlebarsTemplateSpy = jest
        .spyOn(dumper, 'copyHandleBarsTemplate')
        .mockImplementation();
      dumper.writeDockerfile(ABSOLUTE_PROJECT_PATH, { dbDialect: 'mongodb' });

      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('Dockerfile.hbs', 'Dockerfile');
    });
  });

  describe('writeDockerCompose', () => {
    describe('when an environment variable FOREST_URL is provided', () => {
      it('should have called copyHandlebarsTemplate with a valid forestUrl is context', () => {
        expect.assertions(1);

        const dumper = createDumper({
          env: {
            FOREST_URL_IS_DEFAULT: false,
            FOREST_URL: 'https://something.com',
          },
        });
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeDockerCompose({
          appConfig: {},
          dbConfig: {},
        });
        const handlebarContext = copyHandlebarsTemplateSpy.mock.calls[0][2];

        // eslint-disable-next-line no-template-curly-in-string
        expect(handlebarContext.forestUrl).toBe('${FOREST_URL-https://something.com}');
      });
    });

    describe('when no environment variable FOREST_URL is provided', () => {
      it('should have called copyHandlebarsTemplate with a valid forestUrl is context', () => {
        expect.assertions(1);

        const dumper = createDumper({
          env: {
            FOREST_URL_IS_DEFAULT: true,
            FOREST_URL: 'DEFAULT_FOREST_URL',
          },
        });
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeDockerCompose({
          appConfig: {},
          dbConfig: {},
        });
        const handlebarContext = copyHandlebarsTemplateSpy.mock.calls[0][2];

        expect(handlebarContext.forestUrl).toBe(false);
      });
    });
  });

  describe('writeForestAdminMiddleware', () => {
    describe('on mongodb', () => {
      it('should compute the handlebars context', () => {
        expect.assertions(1);

        const dumper = createDumper();
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeForestAdminMiddleware('mongodb');

        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith(
          'middlewares/forestadmin.hbs',
          'middlewares/forestadmin.js',
          { isMongoDB: true },
        );
      });
    });

    describe('on sql based DBS', () => {
      it('should compute the handlebars context', () => {
        expect.assertions(1);

        const dumper = createDumper();
        const copyHandlebarsTemplateSpy = jest
          .spyOn(dumper, 'copyHandleBarsTemplate')
          .mockImplementation();
        dumper.writeForestAdminMiddleware('mysql');

        expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith(
          'middlewares/forestadmin.hbs',
          'middlewares/forestadmin.js',
          { isMongoDB: false },
        );
      });
    });
  });

  describe('dump', () => {
    it('should call all the mandatory functions required to generate a complete project', async () => {
      expect.assertions(27);

      const mkdirpMock = jest.fn();
      const dumper = createDumper({
        mkdirp: mkdirpMock,
      });
      const writeForestCollectionSpy = jest
        .spyOn(dumper, 'writeForestCollection')
        .mockImplementation();
      const writeForestAdminMiddlewareSpy = jest
        .spyOn(dumper, 'writeForestAdminMiddleware')
        .mockImplementation();
      const writeModelsIndexSpy = jest.spyOn(dumper, 'writeModelsIndex').mockImplementation();
      const writeModelSpy = jest.spyOn(dumper, 'writeModel').mockImplementation();
      const writeRouteSpy = jest.spyOn(dumper, 'writeRoute').mockImplementation();
      const writeDotEnvSpy = jest.spyOn(dumper, 'writeDotEnv').mockImplementation();
      const writeAppJsSpy = jest.spyOn(dumper, 'writeAppJs').mockImplementation();
      const writeDatabasesConfigSpy = jest
        .spyOn(dumper, 'writeDatabasesConfig')
        .mockImplementation();
      const writeDockerComposeSpy = jest.spyOn(dumper, 'writeDockerCompose').mockImplementation();
      const writeDockerfileSpy = jest.spyOn(dumper, 'writeDockerfile').mockImplementation();
      const writePackageJsonSpy = jest.spyOn(dumper, 'writePackageJson').mockImplementation();
      const copyHandlebarsTemplateSpy = jest
        .spyOn(dumper, 'copyHandleBarsTemplate')
        .mockImplementation();

      const projectPath = `${ABSOLUTE_PROJECT_PATH}/test-output/unit-test-dumper`;

      const schema = {
        testModel: { fields: {}, references: [], options: {} },
      };
      const config = {
        appConfig: {
          appName: 'test-output/unit-test-dumper',
        },
        dbConfig: {
          dbDialect: '',
        },
      };
      await dumper.dump(config, schema);

      expect(mkdirpMock).toHaveBeenCalledTimes(8);
      expect(mkdirpMock).toHaveBeenCalledWith(projectPath);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/routes`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/forest`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/models`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/config`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/public`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/views`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/middlewares`);

      // Files associated with each models of the schema
      expect(writeModelSpy).toHaveBeenCalledWith(config, 'testModel', {}, [], {});
      expect(writeRouteSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect, 'testModel');
      expect(writeForestCollectionSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect, 'testModel');

      // General app files, based on config
      expect(writeForestAdminMiddlewareSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect);
      expect(writeModelsIndexSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect);
      expect(writeDotEnvSpy).toHaveBeenCalledWith(config);
      expect(writeDatabasesConfigSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect);
      expect(writeAppJsSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect);
      expect(writeDockerComposeSpy).toHaveBeenCalledWith(config);
      expect(writeDockerfileSpy).toHaveBeenCalledWith();
      expect(writePackageJsonSpy).toHaveBeenCalledWith(
        config.dbConfig.dbDialect,
        config.appConfig.appName,
      );

      // Copied files
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledTimes(6);
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith(
        `middlewares/welcome.hbs`,
        'middlewares/welcome.js',
      );
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith(
        `public/favicon.png`,
        'public/favicon.png',
      );
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('views/index.hbs', 'views/index.html');
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('dockerignore.hbs', '.dockerignore');
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('gitignore.hbs', '.gitignore');
      expect(copyHandlebarsTemplateSpy).toHaveBeenCalledWith('server.hbs', 'server.js');
    });

    it('should call all the mandatory functions required to update project', async () => {
      expect.assertions(19);

      const mkdirpMock = jest.fn();
      const dumper = createDumper({
        mkdirp: mkdirpMock,
      });
      const writeForestCollectionSpy = jest
        .spyOn(dumper, 'writeForestCollection')
        .mockImplementation();
      const writeForestAdminMiddlewareSpy = jest
        .spyOn(dumper, 'writeForestAdminMiddleware')
        .mockImplementation();
      const writeModelsIndexSpy = jest.spyOn(dumper, 'writeModelsIndex').mockImplementation();
      const writeModelSpy = jest.spyOn(dumper, 'writeModel').mockImplementation();
      const writeRouteSpy = jest.spyOn(dumper, 'writeRoute').mockImplementation();
      const writeDotEnvSpy = jest.spyOn(dumper, 'writeDotEnv').mockImplementation();
      const writeAppJsSpy = jest.spyOn(dumper, 'writeAppJs').mockImplementation();
      const writeDatabasesConfigSpy = jest
        .spyOn(dumper, 'writeDatabasesConfig')
        .mockImplementation();
      const writeDockerComposeSpy = jest.spyOn(dumper, 'writeDockerCompose').mockImplementation();
      const writeDockerfileSpy = jest.spyOn(dumper, 'writeDockerfile').mockImplementation();
      const writePackageJsonSpy = jest.spyOn(dumper, 'writePackageJson').mockImplementation();
      const copyHandlebarsTemplateSpy = jest
        .spyOn(dumper, 'copyHandleBarsTemplate')
        .mockImplementation();
      jest.spyOn(Dumper, 'shouldSkipRouteGenerationForModel');

      const projectPath = `${ABSOLUTE_PROJECT_PATH}/test-output/unit-test-dumper`;

      const schema = {
        testModel: { fields: {}, references: [], options: {} },
      };
      const config = {
        appConfig: {
          appName: 'test-output/unit-test-dumper',
          isUpdate: true,
          modelsExportPath: 'test',
          useMultiDatabase: true,
        },
        dbConfig: {},
      };
      await dumper.dump(config, schema);

      expect(mkdirpMock).toHaveBeenCalledTimes(5);
      expect(mkdirpMock).toHaveBeenCalledWith(projectPath);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/routes`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/forest`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/models`);
      expect(mkdirpMock).toHaveBeenCalledWith(`${projectPath}/models/test`);

      // Files associated with each models of the schema
      expect(writeModelSpy).toHaveBeenCalledWith(config, 'testModel', {}, [], {});
      expect(writeRouteSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect, 'testModel');
      expect(writeForestCollectionSpy).toHaveBeenCalledWith(config.dbConfig.dbDialect, 'testModel');

      // General app files, based on config
      expect(writeForestAdminMiddlewareSpy).not.toHaveBeenCalled();
      expect(writeModelsIndexSpy).not.toHaveBeenCalled();
      expect(writeDotEnvSpy).not.toHaveBeenCalled();
      expect(writeDatabasesConfigSpy).not.toHaveBeenCalled();
      expect(writeAppJsSpy).not.toHaveBeenCalled();
      expect(writeDockerComposeSpy).not.toHaveBeenCalled();
      expect(writeDockerfileSpy).not.toHaveBeenCalled();
      expect(writePackageJsonSpy).not.toHaveBeenCalled();

      expect(Dumper.shouldSkipRouteGenerationForModel).toHaveBeenCalledWith('testModel');

      // Copied files
      expect(copyHandlebarsTemplateSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkForestCLIProjectStructure', () => {
    it('should not throw an error when structure is correct', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockReturnValue(true),
        },
      });

      expect(() => dumper.checkForestCLIProjectStructure()).not.toThrow();
    });

    it('should throw an error when missing routes folder', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockImplementation(path => !path.includes('routes')),
        },
      });

      expect(() => dumper.checkForestCLIProjectStructure()).toThrow(
        InvalidForestCLIProjectStructureError,
      );
    });

    it('should throw an error when missing forest folder', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockImplementation(path => !path.includes('forest')),
        },
      });

      expect(() => dumper.checkForestCLIProjectStructure()).toThrow(
        InvalidForestCLIProjectStructureError,
      );
    });

    it('should throw an error when missing models folder', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockImplementation(path => !path.includes('models')),
        },
      });

      expect(() => dumper.checkForestCLIProjectStructure()).toThrow(
        InvalidForestCLIProjectStructureError,
      );
    });
  });

  describe('checkLianaCompatiblityForUpdate', () => {
    describe('when liana is compatible', () => {
      it('should not throw with liana version 7.0.0', () => {
        expect.assertions(1);

        const dumper = createDumper({
          fs: {
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue('forest-express-sequelize: ^7.0.0,'),
          },
        });

        expect(() => dumper.checkLianaCompatiblityForUpdate()).not.toThrow();
      });

      it('should not throw with liana version 7.0.11', () => {
        expect.assertions(1);

        const dumper = createDumper({
          fs: {
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue('forest-express-sequelize: ^7.0.11,'),
          },
        });

        expect(() => dumper.checkLianaCompatiblityForUpdate()).not.toThrow();
      });

      it('should not throw with liana version 7.11.0', () => {
        expect.assertions(1);

        const dumper = createDumper({
          fs: {
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue('forest-express-sequelize: ^7.11.0,'),
          },
        });

        expect(() => dumper.checkLianaCompatiblityForUpdate()).not.toThrow();
      });

      it('should not throw with liana version 11.0.0', () => {
        expect.assertions(1);

        const dumper = createDumper({
          fs: {
            existsSync: jest.fn().mockReturnValue(true),
            readFileSync: jest.fn().mockReturnValue('forest-express-sequelize: ^11.0.0,'),
          },
        });

        expect(() => dumper.checkLianaCompatiblityForUpdate()).not.toThrow();
      });
    });

    it('should throw an error when package.json does not exist', async () => {
      expect.assertions(3);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockReturnValue(false),
        },
      });

      let dumperError;
      try {
        dumper.checkLianaCompatiblityForUpdate();
      } catch (error) {
        dumperError = error;
      }
      expect(dumperError).toBeInstanceOf(IncompatibleLianaForUpdateError);
      expect(dumperError).toHaveProperty('message', 'The liana is incompatible for update');
      const packagePath = 'package.json';
      expect(dumperError).toHaveProperty(
        'reason',
        `"${packagePath}" not found in current directory.`,
      );
    });

    it('should throw an error when liana version is less than 7', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockReturnValue(true),
          readFileSync: jest.fn().mockReturnValue('forest-express-sequelize: ^6.0.0,'),
        },
      });

      expect(() => dumper.checkLianaCompatiblityForUpdate()).toThrow(
        new IncompatibleLianaForUpdateError(
          'Your project is not compatible with the `lforest schema:update` command. You need to use an agent version greater than 7.0.0.',
        ),
      );
    });

    it('should throw an error when liana version is not found on package.json', () => {
      expect.assertions(1);

      const dumper = createDumper({
        fs: {
          existsSync: jest.fn().mockReturnValue(true),
          readFileSync: jest.fn().mockReturnValue(''),
        },
      });

      expect(() => dumper.checkLianaCompatiblityForUpdate()).toThrow(
        new IncompatibleLianaForUpdateError(
          'Your project is not compatible with the `lforest schema:update` command. You need to use an agent version greater than 7.0.0.',
        ),
      );
    });
  });

  describe('hasMultipleDatabaseStructure', () => {
    it('should return false if models folder contains some js files', () => {
      expect.assertions(1);

      const mockedFiles = [
        {
          name: 'index.js',
          isFile: () => true,
        },
        {
          name: 'user.js',
          isFile: () => true,
        },
        {
          name: 'databaseFolder',
          isFile: () => false,
        },
      ];

      const dumper = createDumper({
        fs: {
          readdirSync: jest.fn().mockReturnValue(mockedFiles),
        },
      });

      expect(dumper.hasMultipleDatabaseStructure()).toBe(false);
    });

    it('should return true if models folder contains only subfolders', () => {
      expect.assertions(1);

      const mockedFiles = [
        {
          name: 'index.js',
          isFile: () => true,
        },
        {
          name: 'databaseFolder',
          isFile: () => false,
        },
      ];

      const dumper = createDumper({
        fs: {
          readdirSync: jest.fn().mockReturnValue(mockedFiles),
        },
      });

      expect(dumper.hasMultipleDatabaseStructure()).toBe(true);
    });
  });

  describe('shouldSkipRouteGenerationForModel', () => {
    describe('when a given model should be ignored', () => {
      it('should return true', () => {
        expect.assertions(2);

        expect(Dumper.shouldSkipRouteGenerationForModel('stats')).toBe(true);
        expect(Dumper.shouldSkipRouteGenerationForModel('Sessions')).toBe(true);
      });
    });

    describe('when a given model should not be ignored', () => {
      it('should return false', () => {
        expect.assertions(2);

        expect(Dumper.shouldSkipRouteGenerationForModel('users')).toBe(false);
        expect(Dumper.shouldSkipRouteGenerationForModel('projects')).toBe(false);
      });
    });
  });
});
