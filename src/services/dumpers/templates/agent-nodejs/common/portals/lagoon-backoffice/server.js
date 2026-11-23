/**
 * Lagoon's onboarding back office: Lagoon's own operators review the applications their customers
 * sent to our bank, outside Forest, through Forest's Gateway API on the bank's agent.
 *
 *   node server.js <path to the Forest project's .env> [port, default 3600] [--agent <url>]
 *
 * - Home: KPIs (backlog, done this week and in 30 days, median time to decide, approval rate,
 *   waiting on the client) and the queue of open Lagoon cases, oldest first.
 * - A case: the applicant, the evidence the retail onboarding workflow reads, the documents (opened
 *   from the agent's file field), the history, and the guided flow: check ID and selfie, screening,
 *   the decision with its evidence, the action. Each step runs the bank's Smart Action and shows the
 *   result card it returns.
 * - Lagoon only: every Gateway call of this server carries partner = Lagoon, rows are checked again,
 *   and a case, its documents and its actions are served only if it passes that filter (cases.js).
 *   A dedicated key whose team has a Forest scope would add the agent's own guarantee.
 * - The key: FOREST_LAGOON_GATEWAY_KEY if the .env has one, else FOREST_GATEWAY_KEY (the partner
 *   portal's service account). Read once, kept in memory, never sent to the browser, printed or
 *   logged (gateway.js masks it out of any error).
 */
const http = require('http');
const path = require('path');

const {
  createGateway,
  forestRecordUrl,
  localOnly,
  passwordGate,
  requirePasswordWhenHosted,
  publicOrigin,
  settingsFrom,
} = require('../partner-portal/gateway');
const cases = require('./cases');
const { expandHome, keyNameIn, option, positional, readJson, send, servePublic } = require('./web');

const PUBLIC = path.join(__dirname, 'public');
const UUID = /^[0-9a-f-]{36}$/;

const argv = process.argv.slice(2);
// The project's .env locally; hosted, no file: the settings are in the environment.
const [envFile, portArg] = positional(argv);
if (!envFile && !process.env[keyNameIn(process.env)]) {
  console.error('Usage: node server.js <path to the Forest project .env> [port] [--agent <url>]');
  process.exit(1);
}

let gateway;
let keyName = 'FOREST_GATEWAY_KEY';

try {
  const file = envFile ? expandHome(envFile) : null;
  keyName = keyNameIn(settingsFrom(file));
  gateway = createGateway(file, {
    keyName,
    agentUrl: option(argv, 'agent'),
  });
} catch (error) {
  console.error(`error: ${error.message}`);
  console.error(
    'Run `forest portals` in the project folder: it guides you to a Gateway key for that .env.',
  );
  process.exit(2);
}

requirePasswordWhenHosted();
const DOCUMENT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const port = Number(portArg || process.env.PORT || 3600);
const origin = publicOrigin(port);

/** A Gateway failure as the browser sees it: what happened, never the key. */
function failure(res, error) {
  if (!(error instanceof cases.GatewayError)) throw error;
  console.warn(`[lagoon-backoffice] ${error.message}`);
  const hints = {
    0: 'The bank’s agent does not answer.',
    401: 'The bank refused the key: check FOREST_LAGOON_GATEWAY_KEY.',
    403: 'The bank does not let this service account do that (its role).',
    404: 'The bank’s agent does not serve the Gateway API yet.',
  };

  return send(res, 502, { error: hints[error.status] || error.message, status: error.status });
}

const caseId = id => {
  if (!UUID.test(id)) throw Object.assign(new Error('Not found'), { status: 404 });

  return id;
};

const ROUTES = [
  [
    'GET',
    /^\/api\/status$/,
    async (req, res) => {
      const ready = await gateway.ready();
      const scope = ready ? await cases.scopeStatus(gateway).catch(() => null) : null;

      return send(res, 200, { partner: cases.PARTNER, bank: ready ? 'ready' : 'not ready', scope });
    },
  ],
  [
    'GET',
    /^\/api\/home$/,
    async (req, res, match, url) => {
      const seen = {};
      const [kpis, queue, scope] = await Promise.all([
        cases.kpis(gateway),
        cases.queue(
          gateway,
          { status: url.searchParams.get('status'), age: url.searchParams.get('age') },
          seen,
        ),
        cases.scopeStatus(gateway),
      ]);

      return send(res, 200, { kpis, queue, scope, hidden: seen.hidden || 0 });
    },
  ],
  [
    'GET',
    /^\/api\/cases\/([^/]+)$/,
    async (req, res, [, id]) => {
      const seen = {};
      const file = await cases.caseFile(gateway, caseId(id), seen);
      if (!file) return send(res, 404, { error: 'No such Lagoon case.' });

      return send(res, 200, {
        ...file,
        hidden: seen.hidden || 0,
        // The case's Activity tab in the bank's Forest: every action run from here is there.
        forestActivityUrl: forestRecordUrl('kyc_cases', file.case.id, 'activity'),
      });
    },
  ],
  [
    'GET',
    /^\/api\/cases\/([^/]+)\/documents\/([^/]+)$/,
    async (req, res, [, id, documentId]) => {
      const file = await cases.documentFile(gateway, caseId(id), caseId(documentId));
      if (!file) return send(res, 404, 'Not found');
      // Only what the bank's uploads take, sandboxed: an HTML or SVG file would run its script
      // here, next to the actions.
      if (!DOCUMENT_TYPES.has(file.mime)) return send(res, 415, 'Not a PDF, PNG or JPEG');

      return send(res, 200, file.buffer, {
        'content-type': file.mime,
        'content-disposition': `inline; filename="${file.name.replace(/[^\w.-]/g, '_')}"`,
        'content-security-policy': 'sandbox',
      });
    },
  ],
  [
    'GET',
    /^\/api\/cases\/([^/]+)\/actions\/(\w+)$/,
    async (req, res, [, id, key]) => {
      if (!cases.ACTIONS[key]) return send(res, 404, { error: 'No such step.' });

      return send(res, 200, { fields: await cases.actionForm(gateway, caseId(id), key) });
    },
  ],
  [
    'POST',
    /^\/api\/cases\/([^/]+)\/actions\/(\w+)$/,
    async (req, res, [, id, key]) => {
      if (!cases.ACTIONS[key]) return send(res, 404, { error: 'No such step.' });
      const { values = {} } = await readJson(req);
      const result = await cases.runAction(gateway, caseId(id), key, values);
      console.log(
        `[lagoon-backoffice] ${cases.ACTIONS[key]} on ${id}: ${result.ok ? 'done' : 'refused'}`,
      );

      return send(res, 200, result);
    },
  ],
];

async function route(req, res) {
  if (!localOnly(req, res) || !passwordGate(req, res)) return null;
  const url = new URL(req.url, origin);
  for (const [method, pattern, handler] of ROUTES) {
    const match = pattern.exec(url.pathname);
    if (match && req.method === method) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await handler(req, res, match, url);
      } catch (error) {
        return failure(res, error);
      }
    }
  }
  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');

  return servePublic(res, PUBLIC, url.pathname);
}

http
  .createServer((req, res) =>
    route(req, res).catch(error => {
      const status = error.status || 500;
      if (status === 500)
        console.error(`[lagoon-backoffice] ${gateway.mask(error.stack || error.message)}`);
      send(res, status, { error: status === 500 ? 'Something went wrong.' : error.message });
    }),
  )
  .listen(port, () => {
    console.log(`Lagoon back office on ${origin}`);
    console.log(
      `Bank: Gateway API of the agent at ${gateway.agentUrl} (${keyName} read from ${
        envFile ? 'the .env' : 'the environment'
      })`,
    );
  })
  .on('error', error => {
    console.error(`error: port ${port}: ${error.message}`);
    process.exit(1);
  });
