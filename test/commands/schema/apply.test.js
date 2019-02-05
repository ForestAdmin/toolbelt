const Nock = require('@fancy-test/nock').default;
const { expect, test } = require('@oclif/test');
const fs = require('fs');

const fancy = test.register('nock', Nock);

describe('schema:apply', () => {
  let parsedBody;

  before(() => {
    const forestadminSchema = `{
      "meta": {
        "liana": "forest-express-sequelize",
        "orm_version": "3.24.8",
        "database_type": "postgres",
        "liana_version": "2.16.9"
      },
      "collections": [
        {
            "name": "Users",
            "idField": "id",
            "primaryKeys": [
              "id"
            ],
            "isCompositePrimary": false,
            "fields": [
              {
                "field": "id",
                "type": "Number",
                "columnName": "id",
                "primaryKey": true
              },
              {
                "field": "createdAt",
                "type": "Date",
                "columnName": "createdAt"
              }
            ],
            "isSearchable": true
          }
      ]
    }`;

    process.chdir('/tmp');
    fs.writeFileSync('./.forestadmin-schema.json', forestadminSchema);
  });

  describe('with no environment secret', () => {
    fancy
      .stderr()
      .stdout()
      .env({ SERVER_HOST: 'http://localhost:3001' })
      .command(['schema:apply'])
      .exit(2)
      .it('should exist with code 2');
  });

  describe('with an environment secret set in "FOREST_ENV_SECRET" environment variable', () => {
    describe('with forest server returning 404', () => {
      fancy
        .stderr()
        .stdout()
        .env({ SERVER_HOST: 'http://localhost:3001', FOREST_ENV_SECRET: 'forestEnvSecret' })
        .nock('http://localhost:3001', (api) => {
          return api.post('/forest/apimaps').reply(404);
        })
        .command(['schema:apply'])
        .exit(4)
        .it('should exit with exit code 4');
    });

    describe('with forest server returning 503', () => {
      fancy
        .stderr()
        .stdout()
        .env({ SERVER_HOST: 'http://localhost:3001', FOREST_ENV_SECRET: 'forestEnvSecret' })
        .nock('http://localhost:3001', (api) => {
          return api.post('/forest/apimaps').reply(503);
        })
        .command(['schema:apply'])
        .exit(5)
        .it('should exit with exit code 5');
    });

    describe('with forest server returning 200', () => {
      describe('with a schema with camelcased keys', () => {
        fancy
          .stderr()
          .stdout()
          .env({ SERVER_HOST: 'http://localhost:3001', FOREST_ENV_SECRET: 'forestEnvSecret' })
          .nock('http://localhost:3001', (api) => {
            return api.post('/forest/apimaps', (body) => {
              parsedBody = body;
              return true;
            }).reply(200);
          })
          .command(['schema:apply'])
          .it('should send the schema', () => {
            expect(parsedBody).to.containSubset({
              meta: {
                liana: 'forest-express-sequelize',
                orm_version: '3.24.8',
                database_type: 'postgres',
                liana_version: '2.16.9',
              },
              data: [
                {
                  type: 'collections',
                  id: 'Users',
                  attributes: {
                    isSearchable: true,
                    name: 'Users',
                  },
                },
              ],
            });
          });
      });

      describe('with a schema with snakecased keys', () => {
        process.chdir('/tmp');
        fs.writeFileSync('./.forestadmin-schema.json', `{
          "meta": {
            "liana": "forest-express-sequelize",
            "orm_version": "3.24.8",
            "database_type": "postgres",
            "liana_version": "2.16.9"
          },
          "collections": [
            {
                "name": "Users",
                "id_field": "id",
                "primary_keys": [
                  "id"
                ],
                "is_composite_primary": false,
                "fields": [
                  {
                    "field": "id",
                    "type": "Number",
                    "column_name": "id",
                    "primary_key": true
                  },
                  {
                    "field": "createdAt",
                    "type": "Date",
                    "column_name": "createdAt"
                  }
                ],
                "is_searchable": true
              }
          ]
        }`);

        fancy
          .stderr()
          .stdout()
          .env({ SERVER_HOST: 'http://localhost:3001', FOREST_ENV_SECRET: 'forestEnvSecret' })
          .nock('http://localhost:3001', (api) => {
            return api.post('/forest/apimaps', (body) => {
              parsedBody = body;
              return true;
            }).reply(200);
          })
          .command(['schema:apply'])
          .it('should send the schema', () => {
            expect(parsedBody).to.containSubset({
              meta: {
                liana: 'forest-express-sequelize',
                orm_version: '3.24.8',
                database_type: 'postgres',
                liana_version: '2.16.9',
              },
              data: [
                {
                  type: 'collections',
                  id: 'Users',
                  attributes: {
                    isSearchable: true,
                    name: 'Users',
                  },
                },
              ],
            });
          });
      });
    });
  });

  describe('with forest server returning nothing', () => {
    fancy
      .stderr()
      .stdout()
      .env({ SERVER_HOST: 'http://localhost:3001', FOREST_ENV_SECRET: 'forestEnvSecret' })
      .nock('http://localhost:3001', (api) => {
        return api.post('/forest/apimaps').reply(500);
      })
      .command(['schema:apply'])
      .exit(6)
      .it('should exit with exit code 6');
  });
});
