const appRoot = require('app-root-path');
const fs = require('fs');

describe('templates > app/server.hbs', () => {
  it('should use the PORT before the APPLICATION_PORT to be sure that the Heroku deployment works well', () => {
    expect.assertions(1);
    const template = fs
      .readFileSync(`${appRoot}/src/services/dumpers/templates/forest-express/server.hbs`)
      .toString();
    expect(template).toStrictEqual(
      expect.stringMatching("process.env.PORT || process.env.APPLICATION_PORT || '3310'"),
    );
  });
});
