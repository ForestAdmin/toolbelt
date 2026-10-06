/**
 * What a database connection failure means for the person who typed the URL, and how to print it
 * without their password.
 */

const SCHEME = /[a-z][a-z0-9+.-]*:\/\//gi;

/** `host`, `host:port`, `[::1]:port`, or a MongoDB list of them. */
const HOST = /^(\[[0-9a-f:.]+\]|[a-z0-9._%-]+)(:\d+)?$/i;

/** Characters a password must URL-encode: unencoded, they end the credentials early. */
const ENDS_CREDENTIALS = /[\s/?#]/;

const startsWithHost = (text: string) =>
  text
    .split(/[/?#\s]/, 1)[0]
    .split(',')
    .every(host => HOST.test(host));

/**
 * The `@` that closes the credentials of `rest` (a URL past its `://`), or -1 when none can.
 *
 * Neither "the first `@`" nor "the last one" works: an unencoded password holds `@`, and a query
 * value may too (`?application_name=cli@host`). A candidate is an `@` followed by a real host, with
 * a clean user part before it.
 *
 * - `strict`, for validation: the first candidate whose whole credentials are clean, and no other
 *   `@` before the query. A later one there means the password held an unencoded `/`, so the URL
 *   reads as another host: ambiguous, and no driver connects with it.
 * - otherwise, for masking: the LAST candidate. Masking a bit too much is the safe side.
 */
function credentialsEnd(rest: string, strict: boolean): number {
  let found = -1;

  for (let at = rest.indexOf('@'); at !== -1; at = rest.indexOf('@', at + 1)) {
    const credentials = rest.slice(0, at);
    const [user] = credentials.split(':');
    const clean = !ENDS_CREDENTIALS.test(strict ? credentials : user) && !user.includes('@');

    if (clean && startsWithHost(rest.slice(at + 1))) {
      if (!strict) found = at;
      else {
        const beforeQuery = rest.slice(at + 1).split(/[?#]/, 1)[0];

        return beforeQuery.includes('@') ? -1 : at;
      }
    }
  }

  return found;
}

/**
 * Hide the credentials of every connection URL in `text`. Robust to a password that was not
 * URL-encoded, `/`, `#` or spaces included: a parser-based mask finds no URL there at all and
 * prints the password in the clear.
 */
export function maskUrlCredentials(text: string): string {
  return text.replace(/[^\n]+/g, line => {
    const schemes = [...line.matchAll(SCHEME)];

    return schemes.reduceRight((masked, scheme, index) => {
      const credentialsStart = scheme.index + scheme[0].length;
      // A URL ends at the next one: its credentials never span two.
      const urlEnd = schemes[index + 1]?.index ?? masked.length;
      const at = credentialsEnd(masked.slice(credentialsStart, urlEnd), false);
      if (at === -1) return masked;

      const credentials = masked.slice(credentialsStart, credentialsStart + at);
      const [user] = credentials.split(':');
      const hidden = user && credentials.includes(':') ? `${user}:***` : '***';

      return `${masked.slice(0, credentialsStart)}${hidden}${masked.slice(credentialsStart + at)}`;
    }, line);
  });
}

export const ENCODE_PASSWORD_HINT =
  'Special characters in the password must be URL-encoded: @ → %40, : → %3A, / → %2F, ? → %3F, # → %23, space → %20.';

/**
 * True when `url` has credentials no driver can read, because a character in the password was
 * not URL-encoded: `/`, `?`, `#` or a space end them early, and the URL reads as another host.
 */
export function hasUnencodedCredentials(url: string): boolean {
  const scheme = new RegExp(SCHEME.source, 'i').exec(url);
  if (!scheme) return false;

  const rest = url.slice(scheme.index + scheme[0].length);

  return (
    rest.includes('@') && credentialsEnd(rest, true) === -1 && credentialsEnd(rest, false) !== -1
  );
}

type ErrorLike = {
  message?: string;
  details?: string;
  code?: string;
  original?: ErrorLike;
  parent?: ErrorLike;
  cause?: ErrorLike;
};

/** Every message and code an error carries, its wrapped causes included. */
function textOf(error: ErrorLike, depth = 0): string {
  if (!error || depth > 3) return '';

  return [
    error.code,
    error.message,
    error.details,
    textOf(error.original, depth + 1),
    textOf(error.parent, depth + 1),
    textOf(error.cause, depth + 1),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Where the URL points, for the messages: never its credentials. */
function target(url?: string): { host?: string; database?: string } {
  const scheme = url && new RegExp(SCHEME.source, 'i').exec(url);
  if (!scheme) return {};

  const rest = url.slice(scheme.index + scheme[0].length);
  const strictEnd = credentialsEnd(rest, true);
  const afterCredentials = rest.slice(
    (strictEnd !== -1 ? strictEnd : credentialsEnd(rest, false)) + 1,
  );
  const [host, path = ''] = afterCredentials.split(/\/(.*)/s);

  return { host: host || undefined, database: path.split(/[?#]/)[0] || undefined };
}

const KNOWN_FAILURES: { matches: RegExp; explain: (at: ReturnType<typeof target>) => string }[] = [
  {
    matches: /provided to SQL data source is not valid|Invalid URL|ERR_INVALID_URL/i,
    explain: () => `This connection URL can't be read. ${ENCODE_PASSWORD_HINT}`,
  },
  {
    matches: /ECONNREFUSED|connection refused/i,
    explain: ({ host }) =>
      `Nothing answers at ${
        host ?? 'that address'
      }: is your database running, on that host and port?`,
  },
  {
    matches: /ENOTFOUND|getaddrinfo|EAI_AGAIN/i,
    explain: ({ host }) =>
      `The host ${host ? `"${host.split(':')[0]}" ` : ''}can't be found: check the URL.`,
  },
  {
    // Postgres 3D000, MySQL ER_BAD_DB_ERROR, SQL Server "Cannot open database".
    matches:
      /database "[^"]*" does not exist|3D000|ER_BAD_DB_ERROR|Unknown database|Cannot open database/i,
    explain: ({ database }) =>
      `The database ${
        database ? `"${database}" ` : ''
      }doesn't exist on that server: check its name in the URL.`,
  },
  {
    // Postgres 28P01, MySQL ER_ACCESS_DENIED_ERROR, SQL Server and MongoDB login failures.
    matches:
      /password authentication failed|28P01|28000|ER_ACCESS_DENIED_ERROR|Access denied for user|Login failed for user|Authentication failed/i,
    explain: () => `The database refused this user or password. ${ENCODE_PASSWORD_HINT}`,
  },
  {
    matches: /timed out|ETIMEDOUT|Server selection timed out/i,
    explain: ({ host }) =>
      `The database at ${
        host ?? 'that address'
      } didn't answer in time: check the host and port, and that it accepts connections from this machine.`,
  },
];

/**
 * A plain explanation of a connection failure the user can fix from their URL, or null when it is
 * not one of those: that is when "unexpected error, open an issue" is the right thing to say.
 */
export function explainDatabaseError(error: ErrorLike, url?: string): string | null {
  const text = textOf(error);
  const known = KNOWN_FAILURES.find(({ matches }) => matches.test(text));

  return known ? known.explain(target(url)) : null;
}
