/**
 * Lagoon, a fictional neobank that opens its accounts at Forest Lab Bank (B2B2X): the customer
 * applies on Lagoon's site, Lagoon's server hands the application to the bank through Forest's
 * Gateway API, and the bank's KYC team sees it in Forest (Retail onboarding inbox).
 *
 *   node server.js <path to the Forest project's .env> [port, default 3500]
 *
 * - The browser talks to this server only. This server reads FOREST_GATEWAY_KEY from the .env
 *   once, keeps it in memory and calls the Gateway with it; the key is never sent to the browser,
 *   printed or logged.
 * - Files the customer uploads stay in uploads/ and are served at /files/<random id>; the bank's
 *   "Upload document" action fetches them from there (the Gateway takes 16 KB per request).
 * - "Use a sample" hands a specimen paper from samples/ (samples.js), clean or flawed.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const {
  createGateway,
  explain,
  forestRecordUrl,
  passwordGate,
  publicOrigin,
} = require('./gateway');
const { sample } = require('./samples');

const PARTNER = 'Lagoon';
const PUBLIC = path.join(__dirname, 'public');
const UPLOADS = path.join(__dirname, 'uploads');
const MAX_FILE = 5 * 1024 * 1024;
const MAX_JSON = 64 * 1024;
const FILE_ID = /^[a-f0-9]{32}$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const SIGNATURES = [
  ['application/pdf', [0x25, 0x50, 0x44, 0x46]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
];
// The portal's fields, as the bank's "Submit application" form names them.
const APPLICATION_FIELDS = {
  firstName: 'First name',
  lastName: 'Last name',
  birthName: 'Birth name',
  dateOfBirth: 'Date of birth',
  placeOfBirth: 'Place of birth',
  nationality: 'Nationality',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  address2: 'Address line 2',
  postalCode: 'Postal code',
  city: 'City',
  country: 'Country',
  taxId: 'Tax ID',
  usPerson: 'US person',
  employmentStatus: 'Employment status',
  occupation: 'Occupation',
  employer: 'Employer',
  incomeBand: 'Income band',
  sourceOfFunds: 'Source of funds',
  sourceOfWealth: 'Source of wealth',
  monthlyIn: 'Expected monthly income',
  monthlyOut: 'Expected monthly spending',
};
const DOCUMENT_TYPES = ['PASSPORT', 'NATIONAL_ID', 'SELFIE', 'PROOF_OF_ADDRESS'];

// The project's .env locally; hosted, no file: the settings are in the environment.
const [envFile, portArg] = process.argv.slice(2);
if (!envFile && !process.env.FOREST_GATEWAY_KEY) {
  console.error('Usage: node server.js <path to the Forest project .env> [port]');
  process.exit(1);
}
const gateway = createGateway(
  envFile ? path.resolve(envFile.replace(/^~(?=\/)/, process.env.HOME)) : null,
);
const port = Number(portArg || process.env.PORT || 3500);
const origin = publicOrigin(port);

fs.mkdirSync(UPLOADS, { recursive: true });

// ---- small HTTP helpers -------------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'content-type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(json ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  try {
    return JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}');
  } catch (error) {
    throw Object.assign(new Error('Invalid request'), { status: error.status || 400 });
  }
}

const mimeOf = buffer =>
  SIGNATURES.find(([, bytes]) => bytes.every((b, i) => buffer[i] === b))?.[0] || null;

// ---- the file store: uploads/<id> and uploads/<id>.json ----------------------------------------

function store(buffer, name) {
  const mime = mimeOf(buffer);
  if (!mime) throw Object.assign(new Error('Send a PDF, PNG or JPEG file.'), { status: 415 });
  const id = crypto.randomBytes(16).toString('hex');
  const safe =
    String(name || 'document')
      .split(/[\\/]/)
      .pop()
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80) || 'document';
  fs.writeFileSync(path.join(UPLOADS, id), buffer);
  fs.writeFileSync(path.join(UPLOADS, `${id}.json`), JSON.stringify({ name: safe, mime }));

  return { id, name: safe, size: buffer.length, url: `${origin}/files/${id}` };
}

function serveFile(res, id) {
  if (!FILE_ID.test(id)) return send(res, 404, 'Not found');
  const file = path.join(UPLOADS, id);
  if (!fs.existsSync(file)) return send(res, 404, 'Not found');
  const { name, mime } = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8'));

  return send(res, 200, fs.readFileSync(file), {
    'content-type': mime,
    'content-disposition': `inline; filename="${name}"`,
    'cache-control': 'no-store',
  });
}

function servePublic(res, urlPath) {
  const name = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const file = path.join(PUBLIC, path.normalize(name));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'Not found');
  }

  return send(res, 200, fs.readFileSync(file), {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
  });
}

// ---- the application, handed to the bank -------------------------------------------------------

const portalReference = () =>
  `LGN-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

function applicationValues(applicant, reference) {
  const values = { Partner: PARTNER, 'Partner reference': reference };
  Object.entries(APPLICATION_FIELDS).forEach(([key, label]) => {
    const value = applicant[key];
    if (value === undefined || value === null || value === '') return;
    if (key === 'monthlyIn' || key === 'monthlyOut') values[label] = Number(value);
    else if (key === 'usPerson') values[label] = Boolean(value);
    else values[label] = String(value).slice(0, 200);
  });

  return values;
}

/** The bank's message names the case it opened: KYC-YYYY-NNNNNN. */
const caseReferenceIn = body => /KYC-\d{4}-\d{6}/.exec(body?.message || '')?.[0] || null;

async function caseId(reference) {
  const found = await gateway.list('kyc_cases', {
    filter: { field: 'reference', operator: 'Equal', value: reference },
    projection: ['id', 'reference'],
    page: { limit: 1, offset: 0 },
  });

  return { status: found.status, id: found.body?.data?.[0]?.id || null, found };
}

async function uploadDocument(kycId, doc) {
  if (!DOCUMENT_TYPES.includes(doc.type) || !FILE_ID.test(doc.fileId || '')) {
    return { type: doc.type, status: 400, ok: false, error: 'Missing file' };
  }
  const values = {
    'Document type': doc.type,
    'File URL': `${origin}/files/${doc.fileId}`,
  };
  if (doc.number) values['Document number'] = String(doc.number).slice(0, 40);
  if (doc.expires) values['Expires on'] = String(doc.expires).slice(0, 10);
  const result = await gateway.execute('kyc_cases', 'Upload document', [kycId], values);
  const ok = result.status === 200 && result.body?.type === 'success';
  if (!ok) console.warn(`[lagoon] Upload document (${doc.type}): ${explain(gateway, result)}`);

  return {
    type: doc.type,
    status: result.status,
    ok,
    error: ok ? null : result.body?.error?.message,
  };
}

async function apply(req, res) {
  const { applicant = {}, documents = [] } = await readJson(req);
  const reference = portalReference();
  const submitted = await gateway.execute(
    'kyc_cases',
    'Submit application',
    [],
    applicationValues(applicant, reference),
  );
  const caseReference = caseReferenceIn(submitted.body);
  if (submitted.status !== 200 || !caseReference) {
    console.warn(`[lagoon] Submit application: ${explain(gateway, submitted)}`);

    return send(res, submitted.status === 0 ? 502 : 422, {
      error:
        submitted.status === 0
          ? 'We cannot reach our bank right now. Please try again in a moment.'
          : gateway.mask(
              submitted.body?.error?.message || 'The bank could not take the application.',
            ),
      status: submitted.status,
    });
  }
  const { id, status } = await caseId(caseReference);
  const uploads = [];
  if (id) {
    // One after the other: the bank files them in the order the customer sent them.
    for (const doc of documents.slice(0, 6)) {
      // eslint-disable-next-line no-await-in-loop
      uploads.push(await uploadDocument(id, doc));
    }
  }
  console.log(
    `[lagoon] ${reference} → ${caseReference}: submit ${
      submitted.status
    }, case lookup ${status}, documents ${uploads.map(u => `${u.type} ${u.status}`).join(', ')}`,
  );

  return send(res, 200, {
    reference,
    caseReference,
    // The case just opened at the bank, in Forest: what happened here shows on the other side.
    forestUrl: id ? forestRecordUrl('kyc_cases', id) : null,
    lookup: status,
    documents: uploads,
  });
}

// ---- routes ------------------------------------------------------------------------------------

function samplePerson(person) {
  return {
    first_name: person.firstName || undefined,
    last_name: person.lastName || undefined,
    date_of_birth: person.dateOfBirth || undefined,
    nationality: person.nationality || undefined,
    address_line1: person.address || undefined,
    postal_code: person.postalCode || undefined,
    city: person.city || undefined,
    document_number: person.number || undefined,
    expires_at: person.expires || undefined,
  };
}

const ROUTES = {
  'GET /api/status': async (req, res) =>
    send(res, 200, { partner: PARTNER, bank: (await gateway.ready()) ? 'ready' : 'not ready' }),
  'POST /api/files': async (req, res) =>
    send(res, 201, store(await readBody(req, MAX_FILE), req.headers['x-file-name'])),
  'POST /api/samples': async (req, res) => {
    const { kind, flawed, person = {} } = await readJson(req);
    const drawn = sample(kind, samplePerson(person), flawed);

    return send(res, 201, store(drawn.buffer, drawn.name));
  },
  'POST /api/apply': apply,
};

async function route(req, res) {
  if (!passwordGate(req, res)) return null;
  const { pathname } = new URL(req.url, origin);
  const handler = ROUTES[`${req.method} ${pathname}`];
  if (handler) return handler(req, res);
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
  if (pathname.startsWith('/files/')) return serveFile(res, pathname.slice(7));

  return servePublic(res, pathname);
}

http
  .createServer((req, res) =>
    route(req, res).catch(error => {
      const status = error.status || 500;
      if (status === 500) console.error(`[lagoon] ${gateway.mask(error.stack || error.message)}`);
      send(res, status, { error: status === 500 ? 'Something went wrong.' : error.message });
    }),
  )
  .listen(port, () => {
    console.log(`Lagoon partner portal on ${origin}`);
    console.log(
      `Bank: Gateway API of the agent at ${gateway.agentUrl} (key read from ${
        envFile ? 'the .env' : 'the environment'
      })`,
    );
  })
  .on('error', error => {
    console.error(`error: port ${port}: ${error.message}`);
    process.exit(1);
  });
