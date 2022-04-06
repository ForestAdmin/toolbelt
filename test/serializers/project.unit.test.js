const projectSerializer = require('../../src/serializers/project');

describe('serializers > Project', () => {
  it('should serialize the simple attributes', () => {
    expect.assertions(1);

    const project = {
      name: 'the project',
      origin: 'the origin',
      agent: 'the agent',
      databaseType: 'the database type',
      architecture: 'the architecture',
    };
    const serialized = projectSerializer.serialize(project);

    expect(serialized).toStrictEqual({
      data: {
        type: 'projects',
        attributes: {
          name: 'the project',
          origin: 'the origin',
          agent: 'the agent',
          database_type: 'the database type',
          architecture: 'the architecture',
        },
      },
    });
  });

  it('should serialize the default environment', async () => {
    expect.assertions(1);

    const project = {
      name: 'the project',
      defaultEnvironment: {
        id: 42,
        name: 'the default environment',
        apiEndpoint: 'the api endpoint',
        type: 'the type',
      },
    };
    const serialized = projectSerializer.serialize(project);

    expect(serialized).toStrictEqual({
      data: {
        type: 'projects',
        attributes: {
          name: 'the project',
        },
        relationships: {
          default_environment: {
            data: {
              id: '42',
              type: 'defaultEnvironments',
            },
          },
        },
      },
      included: [
        {
          type: 'defaultEnvironments',
          id: '42',
          attributes: {
            name: 'the default environment',
            api_endpoint: 'the api endpoint',
            type: 'the type',
          },
        },
      ],
    });
  });
});
