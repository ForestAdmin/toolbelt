const sinon = require('sinon');
const PrompterError = require('../../../src/services/prompter/prompter-error');
const { DatabasePrompts } = require('../../../src/services/prompter/database-prompts');
const messages = require('../../../src/utils/messages');

const CONNECTION_URL_POSTGRES = 'postgres://username:password@host:port/database';

describe('services > prompter > database prompts', () => {
  let env = {};
  let requests = [];
  let program = {};
  let prompts = [];

  function resetParams() {
    env = {};
    requests = [];
    program = {};
    prompts = [];
  }

  describe('handling database related prompts', () => {
    let databasePrompts;
    let connectionUrlHandlerStub;
    let dialectHandlerStub;
    let nameHandlerStub;
    let schemaHandlerStub;
    let hostNameHandlerStub;
    let portHandlerStub;
    let userHandlerStub;
    let passwordHandlerStub;
    let sslHandlerStub;
    let mongoSrvHandlerStub;

    // eslint-disable-next-line jest/no-hooks
    beforeAll(async () => {
      databasePrompts = new DatabasePrompts(requests, env, prompts, program);
      connectionUrlHandlerStub = sinon.stub(databasePrompts, 'handleConnectionUrl');
      dialectHandlerStub = sinon.stub(databasePrompts, 'handleDialect');
      nameHandlerStub = sinon.stub(databasePrompts, 'handleName');
      schemaHandlerStub = sinon.stub(databasePrompts, 'handleSchema');
      hostNameHandlerStub = sinon.stub(databasePrompts, 'handleHostname');
      portHandlerStub = sinon.stub(databasePrompts, 'handlePort');
      userHandlerStub = sinon.stub(databasePrompts, 'handleUser');
      passwordHandlerStub = sinon.stub(databasePrompts, 'handlePassword');
      sslHandlerStub = sinon.stub(databasePrompts, 'handleSsl');
      mongoSrvHandlerStub = sinon.stub(databasePrompts, 'handleMongodbSrv');
      await databasePrompts.handlePrompts();
    });

    // eslint-disable-next-line jest/no-hooks
    afterAll(() => {
      connectionUrlHandlerStub.restore();
      dialectHandlerStub.restore();
      nameHandlerStub.restore();
      schemaHandlerStub.restore();
      hostNameHandlerStub.restore();
      portHandlerStub.restore();
      userHandlerStub.restore();
      passwordHandlerStub.restore();
      sslHandlerStub.restore();
      mongoSrvHandlerStub.restore();
      resetParams();
    });

    it('should handle the connection url', () => {
      expect.assertions(1);
      expect(connectionUrlHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the dialect', () => {
      expect.assertions(1);
      expect(dialectHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the name', () => {
      expect.assertions(1);
      expect(nameHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the schema', () => {
      expect.assertions(1);
      expect(schemaHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the port', () => {
      expect.assertions(1);
      expect(portHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the user', () => {
      expect.assertions(1);
      expect(userHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle the password', () => {
      expect.assertions(1);
      expect(passwordHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle ssl usage', () => {
      expect.assertions(1);
      expect(sslHandlerStub.calledOnce).toStrictEqual(true);
    });

    it('should handle mongodb srv usage', () => {
      expect.assertions(1);
      expect(mongoSrvHandlerStub.calledOnce).toStrictEqual(true);
    });
  });

  describe('handling connection url', () => {
    describe('when the dbConnectionUrl option is requested', () => {
      describe('and the dbConnectionUrl has already been passed in', () => {
        describe('and the dbConnectionUrl is valid', () => {
          it('should add the dbConnectionUrl to the configuration', async () => {
            expect.assertions(1);
            requests.push('dbConnectionUrl');
            program.databaseConnectionURL = CONNECTION_URL_POSTGRES;

            const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

            await databasePrompts.handleConnectionUrl();

            expect(env.databaseConnectionURL).toStrictEqual(CONNECTION_URL_POSTGRES);
            resetParams();
          });

          it('should add the dbDialect to configuration', async () => {
            expect.assertions(1);
            requests.push('dbConnectionUrl');
            const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

            program.databaseConnectionURL = CONNECTION_URL_POSTGRES;

            await databasePrompts.handleConnectionUrl();

            expect(env.databaseDialect).toStrictEqual('postgres');
            resetParams();
          });

          it('should add the mongo dbDialect to configuration when using mongo+srv', async () => {
            expect.assertions(1);
            requests.push('dbConnectionUrl');
            const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

            program.databaseConnectionURL = 'mongodb+srv://username:password@host1:port1/database';

            await databasePrompts.handleConnectionUrl();

            expect(env.databaseDialect).toStrictEqual('mongodb');
            resetParams();
          });
        });

        describe('and the dbConnectionUrl is invalid', () => {
          it('should throw a prompter error', async () => {
            expect.assertions(2);
            requests.push('dbConnectionUrl');
            program.databaseConnectionURL = 'invalid';
            const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
            await expect(databasePrompts.handleConnectionUrl()).rejects.toThrow(PrompterError);
            await expect(databasePrompts.handleConnectionUrl()).rejects
              .toThrow(messages.ERROR_NOT_PARSABLE_CONNECTION_URL);
            resetParams();
          });
        });
      });
    });

    describe('when the dbConnectionUrl option is not requested', () => {
      it('should not prompt for database connection url', async () => {
        expect.assertions(5);
        program.databaseConnectionURL = CONNECTION_URL_POSTGRES;
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        expect(env.databaseConnectionURL).toBeUndefined();
        expect(prompts).toHaveLength(0);

        await databasePrompts.handleConnectionUrl();

        expect(env.databaseConnectionURL).toBeUndefined();
        expect(env.databaseConnectionURL).not.toStrictEqual(CONNECTION_URL_POSTGRES);
        expect(prompts).toHaveLength(0);
        resetParams();
      });
    });
  });

  describe('handling dialect', () => {
    describe('when the dbDialect option is requested', () => {
      describe('not using windows', () => {
        function initTestWithDatabaseDialect() {
          requests.push('dbDialect');
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
          databasePrompts.handleDialect();
        }

        it('should add a prompt to ask for the database dialect', () => {
          expect.assertions(1);
          initTestWithDatabaseDialect();
          expect(prompts).toHaveLength(1);
          resetParams();
        });

        it('should add a database dialect prompt with the correct configuration', () => {
          expect.assertions(4);
          initTestWithDatabaseDialect();
          expect(prompts[0].type).toStrictEqual('list');
          expect(prompts[0].name).toStrictEqual('databaseDialect');
          expect(prompts[0].message).toStrictEqual('What\'s the database type?');
          expect(prompts[0].choices).toStrictEqual(['mongodb', 'mssql', 'mysql', 'postgres']);
          resetParams();
        });

        it('should not change the configuration', () => {
          expect.assertions(1);
          initTestWithDatabaseDialect();
          expect(env.databaseDialect).toBeUndefined();
          resetParams();
        });
      });

      describe('using windows', () => {
        it('should change prompt type form `list` to `rawlist`', () => {
          expect.assertions(1);
          requests.push('dbDialect');
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
          const platformStub = sinon.stub(process, 'platform').value('win32');
          databasePrompts.handleDialect();
          expect(prompts[0].type).toStrictEqual('rawlist');
          resetParams();
          platformStub.restore();
        });
      });
    });

    describe('when the dbDialect option is not requested', () => {
      it('should not prompt for database dialect', async () => {
        expect.assertions(4);
        resetParams();
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

        expect(env.databaseDialect).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handleDialect();

        expect(env.databaseDialect).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling name', () => {
    describe('when the dbName option is requested', () => {
      function initTestWithDatabaseName() {
        requests.push('dbName');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handleName();
      }

      it('should add a prompt to ask for the database name', () => {
        expect.assertions(1);
        initTestWithDatabaseName();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a database name prompt with the correct configuration', () => {
        expect.assertions(4);
        initTestWithDatabaseName();
        expect(prompts[0].type).toStrictEqual('input');
        expect(prompts[0].name).toStrictEqual('databaseName');
        expect(prompts[0].message).toStrictEqual('What\'s the database name?');
        expect(prompts[0].validate).toBeInstanceOf(Function);
        resetParams();
      });

      it('should validate that the name has been filed', () => {
        expect.assertions(2);
        initTestWithDatabaseName();
        expect(prompts[0].validate('')).toStrictEqual('Please specify the database name.');
        expect(prompts[0].validate('name')).toStrictEqual(true);
        resetParams();
      });
    });

    describe('when the dbName option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not do prompt for database name', async () => {
        expect.assertions(4);
        expect(env.databaseDialect).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handleName();

        expect(env.databaseDialect).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling schema', () => {
    describe('when the dbSchema option is requested', () => {
      describe('and the dbSchema has been been passed in', () => {
        it('should add the dbSchema to the configuration', () => {
          expect.assertions(1);
          requests.push('dbSchema');
          program.databaseSchema = 'fakeSchema';
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
          databasePrompts.handleSchema();

          expect(env.databaseSchema).toStrictEqual(program.databaseSchema);
          resetParams();
        });
      });

      describe('and the dbSchema has not been passed in', () => {
        function initTestWithDatabaseSchema() {
          requests.push('dbSchema');
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
          databasePrompts.handleSchema();
        }

        it('should not add the dbSchema to the configuration', () => {
          expect.assertions(1);
          initTestWithDatabaseSchema();
          expect(env.databaseSchema).toBeUndefined();
          resetParams();
        });

        it('should add a prompt to ask for the database schema name', () => {
          expect.assertions(1);
          initTestWithDatabaseSchema();
          expect(prompts).toHaveLength(1);
          resetParams();
        });

        it('should add a database schema name prompt with the correct configuration', () => {
          expect.assertions(6);
          initTestWithDatabaseSchema();
          expect(prompts[0].type).toStrictEqual('input');
          expect(prompts[0].name).toStrictEqual('databaseSchema');
          expect(prompts[0].message).toStrictEqual('What\'s the database schema? [optional]');
          expect(prompts[0].description).toStrictEqual('Leave blank by default');
          expect(prompts[0].when).toBeInstanceOf(Function);
          expect(prompts[0].default).toBeInstanceOf(Function);
          resetParams();
        });

        it('should be prompted only if using postgres or mssql', () => {
          expect.assertions(4);
          initTestWithDatabaseSchema();
          expect(prompts[0].when({ databaseDialect: 'mongodb' })).toStrictEqual(false);
          expect(prompts[0].when({ databaseDialect: 'mysql' })).toStrictEqual(false);
          expect(prompts[0].when({ databaseDialect: 'postgres' })).toStrictEqual(true);
          expect(prompts[0].when({ databaseDialect: 'mssql' })).toStrictEqual(true);
          resetParams();
        });

        it('should set the correct default schema values', () => {
          expect.assertions(2);
          initTestWithDatabaseSchema();
          expect(prompts[0].default({ databaseDialect: 'postgres' })).toStrictEqual('public');
          expect(prompts[0].default({ databaseDialect: 'mssql' })).toStrictEqual('');
          resetParams();
        });
      });
    });

    describe('when the dbSchema option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for database schema name', async () => {
        expect.assertions(4);
        expect(env.databaseSchema).toBeUndefined();
        expect(prompts).toHaveLength(0);

        await databasePrompts.handleSchema();

        expect(env.databaseSchema).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling Hostname', () => {
    describe('when the dbHostname option is requested', () => {
      function initTestWithDatabaseHostname() {
        requests.push('dbHostname');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handleHostname();
      }

      it('should add a prompt to ask for the database hostname', () => {
        expect.assertions(1);
        initTestWithDatabaseHostname();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a database hostname prompt with the correct configuration', () => {
        expect.assertions(4);
        initTestWithDatabaseHostname();
        expect(prompts[0].type).toStrictEqual('input');
        expect(prompts[0].name).toStrictEqual('databaseHost');
        expect(prompts[0].message).toStrictEqual('What\'s the database hostname?');
        expect(prompts[0].default).toStrictEqual('localhost');
        resetParams();
      });
    });

    describe('when the dbHostname option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for database hostname', () => {
        expect.assertions(4);
        expect(env.dbHostname).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handleHostname();

        expect(env.dbHostname).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling port', () => {
    describe('when the dbPort option is requested', () => {
      function initTestWithDatabasePort() {
        requests.push('dbPort');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handlePort();
      }

      it('should add a prompt to ask for the database port', () => {
        expect.assertions(1);
        initTestWithDatabasePort();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a database port prompt with the correct configuration', () => {
        expect.assertions(5);
        initTestWithDatabasePort();
        expect(prompts[0].type).toStrictEqual('input');
        expect(prompts[0].name).toStrictEqual('databasePort');
        expect(prompts[0].message).toStrictEqual('What\'s the database port?');
        expect(prompts[0].default).toBeInstanceOf(Function);
        expect(prompts[0].validate).toBeInstanceOf(Function);
        resetParams();
      });

      it('should set the correct default port values', () => {
        expect.assertions(4);
        initTestWithDatabasePort();
        expect(prompts[0].default({ databaseDialect: 'postgres' })).toStrictEqual('5432');
        expect(prompts[0].default({ databaseDialect: 'mysql' })).toStrictEqual('3306');
        expect(prompts[0].default({ databaseDialect: 'mssql' })).toStrictEqual('1433');
        expect(prompts[0].default({ databaseDialect: 'mongodb' })).toStrictEqual('27017');
        resetParams();
      });

      it('should validate the value filed', () => {
        expect.assertions(3);
        initTestWithDatabasePort();
        expect(prompts[0].validate('not a number')).toStrictEqual('The port must be a number.');
        expect(prompts[0].validate(70000)).toStrictEqual('This is not a valid port.');
        expect(prompts[0].validate(60000)).toStrictEqual(true);
        resetParams();
      });
    });

    describe('when the dbPort option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for database port', () => {
        expect.assertions(4);
        expect(env.databasePort).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handlePort();

        expect(env.databasePort).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling User', () => {
    describe('when the dbUser option is requested', () => {
      function initTestWithDatabaseUser() {
        requests.push('dbUser');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handleUser();
      }

      it('should add a prompt to ask for the database user', () => {
        expect.assertions(1);
        initTestWithDatabaseUser();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a database user prompt with the correct configuration', () => {
        expect.assertions(4);
        initTestWithDatabaseUser();
        expect(prompts[0].type).toStrictEqual('input');
        expect(prompts[0].name).toStrictEqual('databaseUser');
        expect(prompts[0].message).toStrictEqual('What\'s the database user?');
        expect(prompts[0].default).toBeInstanceOf(Function);
        resetParams();
      });

      it('should set the correct default database user values', () => {
        expect.assertions(4);
        initTestWithDatabaseUser();
        expect(prompts[0].default({ databaseDialect: 'mongodb' })).toBeUndefined();
        expect(prompts[0].default({ databaseDialect: 'mysql' })).toStrictEqual('root');
        expect(prompts[0].default({ databaseDialect: 'mssql' })).toStrictEqual('root');
        expect(prompts[0].default({ databaseDialect: 'postgres' })).toStrictEqual('root');
        resetParams();
      });
    });

    describe('when the dbUser option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for database user', () => {
        expect.assertions(4);
        expect(env.databaseUser).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handleUser();

        expect(env.databaseUser).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling Password', () => {
    describe('when the dbPassword option is requested', () => {
      function initTestWithDatabasePassword() {
        requests.push('dbPassword');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handlePassword();
      }

      it('should add a prompt to ask for the database password', () => {
        expect.assertions(1);
        initTestWithDatabasePassword();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a database password prompt with the correct configuration', () => {
        expect.assertions(3);
        initTestWithDatabasePassword();
        expect(prompts[0].type).toStrictEqual('password');
        expect(prompts[0].name).toStrictEqual('databasePassword');
        expect(prompts[0].message).toStrictEqual('What\'s the database password? [optional]');
        resetParams();
      });
    });

    describe('when the dbPassword option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for database password', () => {
        expect.assertions(4);
        expect(env.databasePassword).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handlePassword();

        expect(env.databasePassword).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling SSL', () => {
    describe('when the ssl option is requested', () => {
      describe('and the ssl option has been passed in', () => {
        it('should set the ssl config option to boolean value', () => {
          expect.assertions(1);
          requests.push('ssl');
          program.databaseSSL = true;
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

          databasePrompts.handleSsl();

          expect(env.databaseSSL).toStrictEqual(true);
          resetParams();
        });
      });

      describe('and the ssl option has not been passed in', () => {
        function initTestWithSSL() {
          requests.push('ssl');
          const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
          databasePrompts.handleSsl();
        }

        it('should add a prompt to ask for the SSL configuration', () => {
          expect.assertions(1);
          initTestWithSSL();
          expect(prompts).toHaveLength(1);
          resetParams();
        });

        it('should add a SSL prompt with the correct configuration', () => {
          expect.assertions(4);
          initTestWithSSL();
          expect(prompts[0].type).toStrictEqual('confirm');
          expect(prompts[0].name).toStrictEqual('databaseSSL');
          expect(prompts[0].message).toStrictEqual('Does your database require a SSL connection?');
          expect(prompts[0].default).toStrictEqual(false);
          resetParams();
        });
      });
    });

    describe('when the ssl option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for ssl configuration', () => {
        expect.assertions(4);
        expect(env.databaseSSL).toBeUndefined();
        expect(prompts).toHaveLength(0);

        databasePrompts.handleSsl();

        expect(env.databaseSSL).toBeUndefined();
        expect(prompts).toHaveLength(0);
      });
    });
  });

  describe('handling Mongodb Srv', () => {
    describe('when the mongodbSrv option is requested', () => {
      function initTestWithMongoSrv() {
        requests.push('mongodbSrv');
        const databasePrompts = new DatabasePrompts(requests, env, prompts, program);
        databasePrompts.handleMongodbSrv();
      }

      it('should add a prompt to ask for the MongodbSrv configuration', () => {
        expect.assertions(1);
        initTestWithMongoSrv();
        expect(prompts).toHaveLength(1);
        resetParams();
      });

      it('should add a MongodbSrv prompt with the correct configuration', () => {
        expect.assertions(5);
        initTestWithMongoSrv();
        expect(prompts[0].type).toStrictEqual('confirm');
        expect(prompts[0].name).toStrictEqual('mongoDBSRV');
        expect(prompts[0].message).toStrictEqual('Use a SRV connection string?');
        expect(prompts[0].default).toStrictEqual(false);
        expect(prompts[0].when).toBeInstanceOf(Function);
        resetParams();
      });

      it('should only be prompted if using mongodb', () => {
        expect.assertions(4);
        initTestWithMongoSrv();
        expect(prompts[0].when({ databaseDialect: 'mongodb' })).toStrictEqual(true);
        expect(prompts[0].when({ databaseDialect: 'mssql' })).toStrictEqual(false);
        expect(prompts[0].when({ databaseDialect: 'mysql' })).toStrictEqual(false);
        expect(prompts[0].when({ databaseDialect: 'postgres' })).toStrictEqual(false);
        resetParams();
      });
    });

    describe('when the mongodbSrv option is not requested', () => {
      const databasePrompts = new DatabasePrompts(requests, env, prompts, program);

      it('should not prompt for MongodbSrv configuration', () => {
        expect.assertions(2);
        expect(prompts).toHaveLength(0);

        databasePrompts.handleMongodbSrv();

        expect(prompts).toHaveLength(0);
      });
    });
  });
});
