/**
 * The portal's line to the bank: Forest's Gateway API on the bank's agent, called from this server
 * only, with the service-account key of the project's .env. The key never reaches the browser and
 * never appears in a log or an error: mask() takes it out of any text before it is shown.
 *
 * Lagoon's back office (../lagoon-backoffice) uses it too, with its own key (`keyName`).
 *
 * Hosted, both apps take the same settings from the process environment instead of a .env file,
 * PUBLIC_URL as their own address, and DEMO_PASSWORD, when set, as a shared password.
 */
const crypto = require('crypto');
const fs = require('fs');

const TIMEZONE = 'Europe/Paris';
const TIMEOUT_MS = 30000;
const KEY_SHAPE = /f(?:gw|bff)_[0-9a-f]{16}_[0-9a-f]{64}/gi;

/** KEY=value lines of a .env file (quotes removed); nothing is printed. */
// Where Forest's app shows this project's records: the portal and the back office link to the case
// they just changed. `forest portals` sets it to the project's Development environment.
const FOREST_APP_URL = (process.env.FOREST_APP_URL || 'https://app.forestadmin.com').replace(
  /\/$/,
  '',
);

/** A record's page in Forest: its details, or another tab (activity, summary…). */
const forestRecordUrl = (collection, id, tab = 'details') =>
  `${FOREST_APP_URL}/data/${collection}/index/record/${collection}/${encodeURIComponent(
    id,
  )}/${tab}`;

function readEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => /^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*)\s*$/.exec(line))
      .filter(Boolean)
      .map(([, name, value]) => [name, value.replace(/^(['"])(.*)\1$/, '$2')]),
  );
}

/** One call to the Gateway: { status, body }, status 0 when the agent did not answer. */
async function request({ base, key, mask }, method, path, body) {
  let response;

  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'X-Forest-Gateway-Key': key,
        'X-Forest-Timezone': TIMEZONE,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      status: 0,
      body: { error: { type: 'unreachable', message: mask(error.cause?.code || error.message) } },
    };
  }

  const raw = await response.text();

  try {
    return { status: response.status, body: raw ? JSON.parse(raw) : {} };
  } catch {
    return {
      status: response.status,
      body: { error: { type: 'not_json', message: mask(raw.slice(0, 200)) } },
    };
  }
}

/** The settings: the project's .env locally, the process environment when hosted (no file). */
const settingsFrom = envFile => (envFile ? readEnv(envFile) : process.env);

function createGateway(envFile, { keyName = 'FOREST_GATEWAY_KEY', agentUrl: url } = {}) {
  const env = settingsFrom(envFile);
  const key = env[keyName];
  if (!key) throw new Error(`${keyName} is missing from ${envFile || 'the environment'}`);
  const agentUrl = (
    url ||
    env.LAB_AGENT_URL ||
    `http://localhost:${env.APPLICATION_PORT || 3310}`
  ).replace(/\/$/, '');
  const base = `${agentUrl}/api/agent/v1`;
  const mask = text =>
    String(text ?? '')
      .split(key)
      .join('fgw_…(hidden)')
      .replace(KEY_SHAPE, 'fgw_…(hidden)');

  const call = (method, path, body) => request({ base, key, mask }, method, path, body);

  return {
    agentUrl,
    mask,
    /** Runs a Smart Action: recordIds [] for a Global one. */
    execute: (collection, action, recordIds, values) =>
      call('POST', `/${collection}/actions/${encodeURIComponent(action)}/execute`, {
        recordIds,
        values,
      }),
    list: (collection, body) => call('POST', `/${collection}/list`, body),
    count: (collection, body) => call('POST', `/${collection}/count`, body),
    /** A to-many relation of one record: { parentId, projection, filter, sort, page }. */
    related: (collection, relation, body) =>
      call('POST', `/${collection}/relations/${relation}/list`, body),
    /** A Smart Action's form, with the values the agent fills in (defaults, hooks). */
    form: (collection, action, recordIds, values = {}) =>
      call('POST', `/${collection}/actions/${encodeURIComponent(action)}/form`, {
        recordIds,
        values,
      }),
    /** Is the Gateway served by the agent? (any answer but 404 or no answer) */
    async ready() {
      try {
        const response = await fetch(`${agentUrl}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });

        return response.status !== 404;
      } catch {
        return false;
      }
    },
  };
}

/** This app's own address: PUBLIC_URL when hosted, else localhost and its port. */
const publicOrigin = port =>
  (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');

const sameText = (a, b) => {
  const [x, y] = [Buffer.from(String(a)), Buffer.from(String(b))];

  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** The machine itself, over IPv4 or IPv6. */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Run locally (no PUBLIC_URL), both apps answer this machine only: they act with the key the
 * server holds, and their port is open on every interface. Answers 403 itself and returns false
 * when the request may not go on.
 */
function localOnly(req, res) {
  if (process.env.PUBLIC_URL || LOOPBACK.has(req.socket.remoteAddress)) return true;
  res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('This demo answers this computer only.');

  return false;
}

/**
 * The shared demo password (DEMO_PASSWORD, any user name), asked by the browser. Off when unset.
 * An uploaded file (GET /files/<random id>) stays open: the bank's agent fetches it from there.
 * The path is read as the router reads it, so `/files/../api/…` is not a file. Answers 401 itself
 * and returns false when the request may not go on.
 */
function passwordGate(req, res) {
  const password = process.env.DEMO_PASSWORD;
  const { pathname } = new URL(req.url, 'http://portal');
  if (!password || (req.method === 'GET' && /^\/files\/[a-f0-9]{32}$/.test(pathname))) {
    return true;
  }
  const [scheme, encoded] = String(req.headers.authorization || '').split(' ');
  const given = scheme === 'Basic' ? Buffer.from(encoded || '', 'base64').toString('utf8') : '';
  if (sameText(given.slice(given.indexOf(':') + 1), password)) return true;
  res.writeHead(401, {
    'www-authenticate': 'Basic realm="Lagoon demo", charset="UTF-8"',
    'content-type': 'text/plain; charset=utf-8',
  });
  res.end('This demo asks for its password.');

  return false;
}

/** A Gateway error as one line, without the key. */
const explain = (gateway, { status, body }) =>
  gateway.mask(`${status} ${body?.error?.type || ''} ${body?.error?.message || ''}`.trim());

module.exports = {
  createGateway,
  explain,
  forestRecordUrl,
  localOnly,
  passwordGate,
  publicOrigin,
  readEnv,
  settingsFrom,
};
