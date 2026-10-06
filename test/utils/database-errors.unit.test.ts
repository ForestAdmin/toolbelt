import {
  ENCODE_PASSWORD_HINT,
  explainDatabaseError,
  hasUnencodedCredentials,
  maskUrlCredentials,
} from '../../src/utils/database-errors';

describe('utils > database-errors', () => {
  describe('maskUrlCredentials', () => {
    it('masks the password of a well-formed URL and keeps the user', () => {
      expect.assertions(1);
      expect(maskUrlCredentials('postgres://forest:s3cret@localhost:5432/shop')).toBe(
        'postgres://forest:***@localhost:5432/shop',
      );
    });

    it('masks a password that was not URL-encoded, which a URL parser cannot even find', () => {
      expect.assertions(1);
      // What the driver quotes back when the user pasted `p@ss:w/rd#1` as is.
      expect(
        maskUrlCredentials(
          'Unable to connect to the given uri: postgres://forest:p@ss:w/rd#1@localhost:5499/shop.',
        ),
      ).toBe('Unable to connect to the given uri: postgres://forest:***@localhost:5499/shop.');
    });

    it('masks every URL of a message, and leaves one without credentials alone', () => {
      expect.assertions(1);
      expect(
        maskUrlCredentials(
          'from mongodb+srv://admin:pw@cluster.x.net/db to https://docs.forest.app/x and mysql://root@h/db',
        ),
      ).toBe(
        'from mongodb+srv://admin:***@cluster.x.net/db to https://docs.forest.app/x and mysql://***@h/db',
      );
    });

    it('keeps a multi-host MongoDB URL readable', () => {
      expect.assertions(1);
      expect(maskUrlCredentials('mongodb://u:pw@h1:27017,h2:27017/db?replicaSet=rs')).toBe(
        'mongodb://u:***@h1:27017,h2:27017/db?replicaSet=rs',
      );
    });
  });

  describe('hasUnencodedCredentials', () => {
    it('flags the characters that end credentials, and accepts what drivers parse', () => {
      expect.assertions(6);
      expect(hasUnencodedCredentials('postgres://u:p@ss:w/rd#1@localhost/db')).toBe(true);
      expect(hasUnencodedCredentials('postgres://u:a?b@localhost/db')).toBe(true);
      expect(hasUnencodedCredentials('postgres://u:a#b@localhost/db')).toBe(true);
      // `@` and `:` alone still parse: the credentials end at the last `@`, the user at the first `:`.
      expect(hasUnencodedCredentials('postgres://u:p@ss:wd@localhost/db')).toBe(false);
      expect(hasUnencodedCredentials('postgres://u:p%40ss%2Fwd@localhost/db')).toBe(false);
      expect(hasUnencodedCredentials('mongodb://u:pw@h1:27017,h2:27017/db?x=1')).toBe(false);
    });
  });

  describe('explainDatabaseError', () => {
    const url = 'postgres://forest:pw@localhost:5499/shop';

    it.each([
      [
        'an unreadable URL',
        'Connection Uri "postgres://forest:p@ss:w/rd#1@localhost/shop" provided to SQL data source is not valid. Should be <dialect>://<connection>.',
        `This connection URL can't be read. ${ENCODE_PASSWORD_HINT}`,
      ],
      [
        'a database that is down',
        'Unable to connect to the given uri: postgres://localhost:5499/shop.\nConnection error: connect ECONNREFUSED 127.0.0.1:5499',
        'Nothing answers at localhost:5499: is your database running, on that host and port?',
      ],
      [
        'a missing database',
        'Unable to connect to the given uri: postgres://localhost:5499/nope.\nConnection error: database "nope" does not exist',
        `The database "shop" doesn't exist on that server: check its name in the URL.`,
      ],
      [
        'a wrong password',
        'password authentication failed for user "forest"',
        `The database refused this user or password. ${ENCODE_PASSWORD_HINT}`,
      ],
      [
        'an unknown host',
        'getaddrinfo ENOTFOUND db.nowhere',
        `The host "localhost" can't be found: check the URL.`,
      ],
    ])('explains %s', (_, message, expected) => {
      expect.assertions(1);
      expect(explainDatabaseError(new Error(message), url)).toBe(expected);
    });

    it('reads the causes a driver wraps, where Sequelize keeps the code', () => {
      expect.assertions(1);
      const error = Object.assign(new Error('SequelizeConnectionRefusedError'), {
        original: { code: 'ECONNREFUSED' },
      });
      expect(explainDatabaseError(error, url)).toMatch(/^Nothing answers at localhost:5499/);
    });

    it('never quotes credentials, even from the URL it was given', () => {
      expect.assertions(1);
      const explanation = explainDatabaseError(
        new Error('connect ECONNREFUSED'),
        'postgres://forest:p@ss:w/rd#1@db.local:5432/shop',
      );
      expect(explanation).not.toMatch(/p@ss|rd#1/);
    });

    it('leaves anything else to the "unexpected error" path', () => {
      expect.assertions(1);
      expect(
        explainDatabaseError(new Error('Cannot read properties of undefined'), url),
      ).toBeNull();
    });
  });
});
