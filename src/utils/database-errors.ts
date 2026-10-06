/**
 * What a database connection failure means for the person who typed the URL, and how to print it
 * without their password.
 */

const SCHEME = /[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Hide the credentials of every connection URL in `text`. Robust to a password that was not
 * URL-encoded: the credentials run from `://` to the LAST `@` of the URL, so `p@ss:w/rd#1` is
 * masked whole, where a parser-based mask finds no URL at all and prints it in the clear.
 */
export function maskUrlCredentials(text: string): string {
  return text
    .split(/(\s+)/)
    .map(token => {
      const scheme = SCHEME.exec(token);
      if (!scheme) return token;

      const credentialsStart = scheme.index + scheme[0].length;
      const at = token.lastIndexOf('@');
      if (at < credentialsStart) return token;

      const user = token.slice(credentialsStart, at).split(':')[0];
      const masked =
        user && token.slice(credentialsStart, at).includes(':') ? `${user}:***` : '***';

      return `${token.slice(0, credentialsStart)}${masked}${token.slice(at)}`;
    })
    .join('');
}

/**
 * Characters that end the credentials of a URL. In a password they must be URL-encoded, or the
 * URL reads as another host, port or path, and no driver can connect with it.
 */
const UNENCODED_IN_CREDENTIALS = /[/?#]/;

export const ENCODE_PASSWORD_HINT =
  'Special characters in the password must be URL-encoded: @ → %40, : → %3A, / → %2F, ? → %3F, # → %23.';

/** True when the credentials of `url` hold a character that must be URL-encoded there. */
export function hasUnencodedCredentials(url: string): boolean {
  const scheme = SCHEME.exec(url);
  if (!scheme) return false;

  const rest = url.slice(scheme.index + scheme[0].length);
  const at = rest.lastIndexOf('@');

  return at > 0 && UNENCODED_IN_CREDENTIALS.test(rest.slice(0, at));
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
  const scheme = url && SCHEME.exec(url);
  if (!scheme) return {};

  const rest = url.slice(scheme.index + scheme[0].length);
  const afterCredentials = rest.slice(rest.lastIndexOf('@') + 1);
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
