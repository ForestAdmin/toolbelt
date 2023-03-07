/* eslint class-methods-use-this: 0 */
// eslint-disable-next-line max-classes-per-file
import type { ConfigInterface } from '../../../src/interfaces/project-create-interface';

import AbstractDumper from '../../../src/services/dumpers/abstract-dumper';

const buildDumper = (ADumper, librairies = {}) => {
  const context = {
    assertPresent: jest.fn(),
    fs: {
      existsSync: jest.fn(),
      writeFileSync: jest.fn(),
      readFileSync: jest.fn(),
    },
    logger: {
      log: jest.fn(),
    },
    chalk: {
      yellow: jest.fn().mockImplementation(content => content),
      green: jest.fn().mockImplementation(content => content),
    },
    constants: {
      CURRENT_WORKING_DIRECTORY: 'aDirectory',
    },
    mkdirp: jest.fn().mockResolvedValue(true),
    Handlebars: {
      compile: jest.fn().mockImplementation(() => () => {}),
    },
    buildDatabaseUrl: jest.fn(),
    ...librairies,
  };
  return {
    dumper: new ADumper(context),
    context,
  };
};

const defaultConfig: ConfigInterface = {
  appConfig: {
    appPort: 3310,
    applicationName: 'anApp',
    appHostname: 'http://localhost',
  },
  dbConfig: {
    dbName: 'aDatabase',
    dbUser: 'aUser',
    dbHostname: 'aHostname',
    dbDialect: 'aDialect',
    dbPassword: 'aPassword',
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    dbPort: null,
    ssl: false,
    dbSchema: 'aSchema',
  },
  forestAuthSecret: 'anAuthSecret',
  forestEnvSecret: 'anEnvSecret',
};

describe('services > dumpers > Abstract Dumper', () => {
  describe('dump', () => {
    class ADumper extends AbstractDumper {
      get templateFolder() {
        return 'aTemplateFolder';
      }

      createFiles = jest.fn().mockResolvedValue(true);
    }

    // TODO check if path should be tested
    it('should create the main directory based on projectPath', async () => {
      expect.assertions(1);

      const { dumper, context } = buildDumper(ADumper);

      await dumper.dump(defaultConfig);

      expect(context.mkdirp).toHaveBeenCalledWith('aDirectory/anApp');
    });

    it('should call createFiles', async () => {
      expect.assertions(1);

      const { dumper } = buildDumper(ADumper);

      await dumper.dump(defaultConfig);

      expect(dumper.createFiles).toHaveBeenCalledWith(defaultConfig, undefined);
    });
  });

  describe('writeFile', () => {
    class ADumper extends AbstractDumper {
      get templateFolder() {
        return 'aTemplateFolder';
      }

      async createFiles() {
        await this.writeFile('aTarget', 'content');
      }
    }
    describe('when the file already exists', () => {
      it('should not write the file', async () => {
        expect.assertions(4);

        const { dumper, context } = buildDumper(ADumper);

        context.fs.existsSync.mockReturnValue(true);

        await dumper.dump(defaultConfig);

        expect(context.fs.existsSync).toHaveBeenCalledWith('aDirectory/anApp/aTarget');
        expect(context.fs.writeFileSync).not.toHaveBeenCalled();
        expect(context.chalk.yellow).toHaveBeenCalledWith('skip');
        expect(context.logger.log).toHaveBeenCalledWith('  skip aTarget - already exists.');
      });
    });
    describe('when the file does not exist', () => {
      it('should write the file in the correct location', async () => {
        expect.assertions(4);

        const { dumper, context } = buildDumper(ADumper);

        context.fs.existsSync.mockReturnValue(false);

        await dumper.dump(defaultConfig);

        expect(context.fs.existsSync).toHaveBeenCalledWith('aDirectory/anApp/aTarget');
        expect(context.fs.writeFileSync).toHaveBeenCalledWith(
          'aDirectory/anApp/aTarget',
          'content',
        );
        expect(context.chalk.green).toHaveBeenCalledWith('create');
        expect(context.logger.log).toHaveBeenCalledWith('  create aTarget');
      });
    });
  });

  describe('copyHandleBarsTemplate', () => {
    describe('when no context has been provided', () => {
      class ADumper extends AbstractDumper {
        get templateFolder() {
          return 'aTemplateFolder';
        }

        async createFiles() {
          await this.copyHandleBarsTemplate('aSource', 'aTarget');
        }
      }

      it('should write the file as it is and not compile it', async () => {
        expect.assertions(4);

        const { dumper, context } = buildDumper(ADumper);
        const writeFileSpy = jest.spyOn(dumper, 'writeFile');

        await dumper.dump(defaultConfig);

        expect(context.Handlebars.compile).not.toHaveBeenCalled();
        const [templateFilePath, format] = context.fs.readFileSync.mock.calls[0];
        expect(templateFilePath).toMatch(/services\/dumpers\/templates\/aTemplateFolder\/aSource$/);
        expect(format).toBe('utf-8');
        expect(writeFileSpy).toHaveBeenCalledWith('aTarget', undefined);
      });
    });
    describe('when context has been provided', () => {
      class ADumper extends AbstractDumper {
        get templateFolder() {
          return 'aTemplateFolder';
        }

        async createFiles() {
          await this.copyHandleBarsTemplate('aSource', 'aTarget', { aValue: 'aValue' });
        }
      }

      it('should compile the source file with context and write it', async () => {
        expect.assertions(4);

        const { dumper, context } = buildDumper(ADumper);
        const writeFileSpy = jest.spyOn(dumper, 'writeFile');

        await dumper.dump(defaultConfig);

        expect(context.Handlebars.compile).toHaveBeenCalledWith(undefined, { noEscape: true });
        const [templateFilePath, format] = context.fs.readFileSync.mock.calls[0];
        expect(templateFilePath).toMatch(/services\/dumpers\/templates\/aTemplateFolder\/aSource$/);
        expect(format).toBe('utf-8');
        expect(writeFileSpy).toHaveBeenCalledWith('aTarget', undefined);
      });
    });
  });
});
