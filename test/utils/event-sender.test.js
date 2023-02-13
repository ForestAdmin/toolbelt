const EventSender = require('../../src/utils/event-sender');

describe('utils > EventSender', () => {
  function setup() {
    const superagent = {
      post: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const env = {
      FOREST_URL: 'https://api.test.forestadmin.com',
    };

    const context = {
      assertPresent: jest.fn(),
      superagent,
      env,
    };
    const eventSender = new EventSender(context);

    return { superagent, ...context, eventSender };
  }
  describe('notifySuccess', () => {
    describe('with missing properties', () => {
      it('should not call the api', async () => {
        expect.assertions(1);

        const { eventSender, superagent } = setup();

        await eventSender.notifySuccess();

        expect(superagent.post).not.toHaveBeenCalled();
      });
    });

    describe('with all the properties', () => {
      it('should call the api', async () => {
        expect.assertions(2);

        const { eventSender, superagent } = setup();

        eventSender.applicationName = 'name';
        eventSender.command = 'projects:create';
        eventSender.meta = {
          projectId: 42,
          dbDialect: 'postgres',
          agent: 'express-sequelize',
          isLocal: true,
        };
        eventSender.sessionToken = 'SESSION-TOKEN';

        await eventSender.notifySuccess();

        expect(superagent.post).toHaveBeenCalledWith(
          'https://api.test.forestadmin.com/api/lumber/success',
          {
            data: {
              attributes: {
                agent: 'express-sequelize',
                command: 'projects:create',
                db_dialect: 'postgres',
                is_local: true,
                project_id: 42,
                project_name: 'name',
              },
              type: 'events',
            },
          },
        );

        expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer SESSION-TOKEN');
      });
    });
  });

  describe('notifyError', () => {
    describe('with missing properties', () => {
      it('should not call the api', async () => {
        expect.assertions(1);

        const { eventSender, superagent } = setup();

        await eventSender.notifyError();

        expect(superagent.post).not.toHaveBeenCalled();
      });
    });

    describe('for the `schema:update` command', () => {
      describe('without session token', () => {
        it('should call the api without meta attributes', async () => {
          expect.assertions(2);

          const { eventSender, superagent } = setup();

          eventSender.applicationName = 'name';
          eventSender.command = 'schema:update';

          await eventSender.notifyError();

          expect(superagent.post).toHaveBeenCalledWith(
            'https://api.test.forestadmin.com/api/lumber/error',
            {
              data: {
                attributes: {
                  code: 'unknown_error',
                  command: 'schema:update',
                  project_name: 'name',
                  context: undefined,
                  message: null,
                },
                type: 'events',
              },
            },
          );

          expect(superagent.set).not.toHaveBeenCalled();
        });
      });
      describe('with session token', () => {
        it('should call the api without meta attributes', async () => {
          expect.assertions(2);

          const { eventSender, superagent } = setup();

          eventSender.applicationName = 'name';
          eventSender.command = 'schema:update';
          eventSender.sessionToken = 'SESSION-TOKEN';

          await eventSender.notifyError();

          expect(superagent.post).toHaveBeenCalledWith(
            'https://api.test.forestadmin.com/api/lumber/error',
            {
              data: {
                attributes: {
                  code: 'unknown_error',
                  command: 'schema:update',
                  project_name: 'name',
                  context: undefined,
                  message: null,
                },
                type: 'events',
              },
            },
          );

          expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer SESSION-TOKEN');
        });
      });
    });

    describe('for other commands', () => {
      describe('without session token', () => {
        it('should call the api with meta attributes', async () => {
          expect.assertions(2);

          const { eventSender, superagent } = setup();

          eventSender.applicationName = 'name';
          eventSender.command = 'projects:create';
          eventSender.meta = {
            projectId: 42,
            dbDialect: 'postgres',
            agent: 'express-sequelize',
            isLocal: true,
          };

          await eventSender.notifyError(
            'database_authentication_error',
            'Database Connection Failed',
          );

          expect(superagent.post).toHaveBeenCalledWith(
            'https://api.test.forestadmin.com/api/lumber/error',
            {
              data: {
                attributes: {
                  agent: 'express-sequelize',
                  code: 'database_authentication_error',
                  command: 'projects:create',
                  context: undefined,
                  db_dialect: 'postgres',
                  is_local: true,
                  message: 'Database Connection Failed',
                  project_id: 42,
                  project_name: 'name',
                },
                type: 'events',
              },
            },
          );

          expect(superagent.set).not.toHaveBeenCalled();
        });
      });
      describe('with session token', () => {
        it('should call the api with meta attributes', async () => {
          expect.assertions(2);

          const { eventSender, superagent } = setup();

          eventSender.applicationName = 'name';
          eventSender.command = 'projects:create';
          eventSender.sessionToken = 'SESSION-TOKEN';
          eventSender.meta = {
            projectId: 42,
            dbDialect: 'postgres',
            agent: 'express-sequelize',
            isLocal: true,
          };

          await eventSender.notifyError(
            'database_authentication_error',
            'Database Connection Failed',
          );

          expect(superagent.post).toHaveBeenCalledWith(
            'https://api.test.forestadmin.com/api/lumber/error',
            {
              data: {
                attributes: {
                  agent: 'express-sequelize',
                  code: 'database_authentication_error',
                  command: 'projects:create',
                  context: undefined,
                  db_dialect: 'postgres',
                  is_local: true,
                  message: 'Database Connection Failed',
                  project_id: 42,
                  project_name: 'name',
                },
                type: 'events',
              },
            },
          );
          expect(superagent.set).toHaveBeenCalledWith('Authorization', 'Bearer SESSION-TOKEN');
        });
      });
    });
  });
});
