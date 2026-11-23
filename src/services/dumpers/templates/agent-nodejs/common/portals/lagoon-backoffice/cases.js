/**
 * What Lagoon's back office reads and runs, through Forest's Gateway API only: its KPIs, its queue,
 * one case with the evidence the retail onboarding workflow reads, its documents and history, and
 * the Smart Actions of the guided flow.
 *
 * Lagoon only, strictly: every list and count carries partner = Lagoon, every row that comes back
 * is checked again (onlyLagoon), and a case must pass the same filter before its page, a document
 * or an action is served (lagoonCase). The key may be the partner portal's, which sees the whole
 * bank. With a dedicated key whose team has a Forest scope (partner = Lagoon), the bank's agent
 * would enforce it too; scopeStatus() tells which.
 */
const PARTNER = 'Lagoon';
const DAY = 24 * 3600 * 1000;
const OPEN = ['OPEN', 'IN_REVIEW', 'WAITING_CUSTOMER', 'PENDING_APPROVAL', 'ESCALATED'];
const DECIDED = ['APPROVED', 'REJECTED'];
// The Smart Actions the back office may run, by the step of the guided flow they belong to.
// No prototype: looked up with a name from the address, `toString` must find nothing.
const ACTIONS = Object.assign(Object.create(null), {
  check: 'Check documents',
  verify: 'Verify document',
  screen: 'Screen against sanctions lists',
  approve: 'Approve KYC',
  missing: 'Request missing documents',
  id: 'Request ID document',
  reject: 'Reject KYC',
});
const CASE_FIELDS = [
  'id',
  'reference',
  'status',
  'type',
  'channel',
  'partner',
  'notes',
  'opened_at',
  'due_at',
  'updated_at',
  'assigned_to',
  'decided_by',
  'resolved_at',
  'escalated_at',
  'escalation_reason',
  'rejection_reason',
  'rejection_code',
  'risk_after',
  'customer_id',
];
// The evidence of the retail onboarding workflow (kyc_retail.json), by step of the guided flow.
const EVIDENCE = {
  applicant: [
    ['applicant_identity', 'Identity'],
    ['applicant_contact', 'Contact'],
    ['applicant_profile', 'Declared profile'],
    ['applicant_volumes', 'Expected volumes'],
  ],
  documents: [
    ['docs_complete', 'Complete'],
    ['doc_id', 'ID document'],
    ['doc_selfie', 'Selfie'],
    ['doc_address', 'Proof of address'],
    ['doc_income', 'Proof of income'],
  ],
  idcheck: [
    ['idcheck_result', 'Result'],
    ['idcheck_documents', 'Documents'],
    ['idcheck_faces', 'Face match'],
  ],
  screening: [['screening_result', 'Result']],
  risk: [
    ['risk_rating_suggested', 'Suggested rating'],
    ['risk_hits', 'Screening hits'],
    ['risk_pep', 'PEP'],
    ['risk_residence', 'Residence'],
    ['risk_funds', 'Occupation and funds'],
    ['risk_volumes', 'Income vs volumes'],
  ],
};
const EVIDENCE_FIELDS = Object.values(EVIDENCE).flatMap(list => list.map(([name]) => name));
const DOCUMENT_FIELDS = [
  'id',
  'document_type',
  'file_name',
  'uploaded_at',
  'check_result',
  'failure_reason',
  'verified_at',
  'verified_by',
  'document_number',
  'issued_at',
  'expires_at',
  'partner',
];

// ---- filters, in the Gateway's format (a condition tree, PascalCase operators) ------------------

const leaf = (field, operator, value) => ({ field, operator, value });
const and = (...conditions) => ({ aggregator: 'And', conditions: conditions.filter(Boolean) });
// The back office's own filter: Lagoon's onboarding cases, on every call.
const lagoon = (...more) =>
  and(leaf('partner', 'Equal', PARTNER), leaf('type', 'Equal', 'ONBOARDING'), ...more);

class GatewayError extends Error {
  constructor(what, result, gateway) {
    const type = result.body?.error?.type || 'error';
    super(gateway.mask(`${what}: ${result.status} ${type} ${result.body?.error?.message || ''}`));
    this.status = result.status;
    this.type = type;
  }
}

// The Gateway answers with camelCase keys (openedAt for opened_at): back to the fields' names.
const snake = record =>
  Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      k.startsWith('__') ? k : k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`),
      v,
    ]),
  );

async function rowsOf(gateway, what, call) {
  const result = await call;
  if (result.status !== 200) throw new GatewayError(what, result, gateway);

  return (result.body.data || []).map(snake);
}

/**
 * Every row of a list, a page at a time (up to 10,000): a single page would hide the rest from the
 * queue, or leave the 30-day figures short. `list` takes the page to read.
 */
async function allRows(gateway, what, list, size = 200) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += size) {
    // eslint-disable-next-line no-await-in-loop -- one page after the other
    const page = await rowsOf(gateway, what, list({ limit: size, offset }));
    rows.push(...page);
    if (page.length < size) break;
  }

  return rows;
}

async function countOf(gateway, what, call) {
  const result = await call;
  if (result.status !== 200) throw new GatewayError(what, result, gateway);

  return result.body.count;
}

/** Rows of another partner, if a response ever holds one: dropped, and counted. */
function onlyLagoon(rows, seen) {
  const kept = rows.filter(r => r.partner === PARTNER);
  Object.assign(seen, { hidden: (seen.hidden || 0) + rows.length - kept.length });

  return kept;
}

// ---- dates -------------------------------------------------------------------------------------

const parsed = value => (value ? new Date(String(value).replace(' ', 'T')) : null);

/** Paris's wall clock at an instant, to the second. */
function parisParts(instant) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(instant)
      .map(p => [p.type, p.value]),
  );
}

/** How far Paris's wall clock is ahead of UTC at an instant (1 or 2 hours). */
function parisOffset(instant) {
  const p = parisParts(instant);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);

  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Monday 00:00 in Paris, this week, with Paris's offset on that Monday (summer time aside). */
function parisMonday(now = new Date()) {
  const p = parisParts(now);
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  const wallMidnight = Date.UTC(p.year, p.month - 1, p.day - back);
  const guess = wallMidnight - parisOffset(now);

  return new Date(wallMidnight - parisOffset(new Date(guess)));
}

const median = list => {
  if (!list.length) return null;
  const sorted = list.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// ---- home: KPIs and the queue ------------------------------------------------------------------

async function kpis(gateway, now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const decidedSince = since =>
    lagoon(leaf('status', 'In', DECIDED), leaf('resolved_at', 'After', since));
  const [backlog, waiting, week, month, decided] = await Promise.all([
    countOf(
      gateway,
      'backlog',
      gateway.count('kyc_cases', { filter: lagoon(leaf('status', 'In', OPEN)) }),
    ),
    countOf(
      gateway,
      'waiting',
      gateway.count('kyc_cases', { filter: lagoon(leaf('status', 'Equal', 'WAITING_CUSTOMER')) }),
    ),
    countOf(
      gateway,
      'this week',
      gateway.count('kyc_cases', { filter: decidedSince(parisMonday(now).toISOString()) }),
    ),
    countOf(gateway, '30 days', gateway.count('kyc_cases', { filter: decidedSince(since30) })),
    allRows(gateway, 'decided', page =>
      gateway.list('kyc_cases', {
        filter: decidedSince(since30),
        projection: ['id', 'status', 'opened_at', 'resolved_at', 'rejection_code', 'partner'],
        sort: [{ field: 'id', direction: 'asc' }],
        page,
      }),
    ),
  ]);
  const approved = decided.filter(k => k.status === 'APPROVED').length;
  // A closure (the applicant stopped answering) is not a refusal: left out of the rate.
  const refused = decided.filter(
    k => k.status === 'REJECTED' && k.rejection_code !== 'NO_RESPONSE',
  ).length;
  const days = median(decided.map(k => (parsed(k.resolved_at) - parsed(k.opened_at)) / DAY));

  return {
    backlog,
    waiting,
    doneWeek: week,
    done30: month,
    medianDays: days === null ? null : Math.round(days * 10) / 10,
    approvalRate: approved + refused ? Math.round((100 * approved) / (approved + refused)) : null,
    approved30: approved,
    refused30: refused,
    closed30: decided.length - approved - refused,
  };
}

const AGES = Object.assign(Object.create(null), {
  new: [0, 1],
  days: [1, 3],
  late: [3, Infinity],
});

/** Open Lagoon cases, oldest first; `status` and `age` (new, days, late) narrow it. */
async function queue(gateway, { status, age } = {}, seen = {}) {
  const statuses = OPEN.includes(status) ? [status] : OPEN;
  const cases = onlyLagoon(
    await allRows(gateway, 'queue', page =>
      gateway.list('kyc_cases', {
        filter: lagoon(leaf('status', 'In', statuses)),
        projection: [
          'id',
          'reference',
          'status',
          'opened_at',
          'due_at',
          'assigned_to',
          'customer_id',
          'partner',
        ],
        sort: [
          { field: 'opened_at', direction: 'asc' },
          { field: 'id', direction: 'asc' },
        ],
        page,
      }),
    ),
    seen,
  );
  const customers = cases.length
    ? onlyLagoon(
        await allRows(gateway, 'customers', page =>
          gateway.list('customers', {
            filter: and(
              leaf('partner', 'Equal', PARTNER),
              leaf(
                'id',
                'In',
                cases.map(k => k.customer_id),
              ),
            ),
            projection: ['id', 'display_name', 'reference', 'risk_rating', 'partner'],
            sort: [{ field: 'id', direction: 'asc' }],
            page,
          }),
        ),
        seen,
      )
    : [];
  const byId = new Map(customers.map(c => [c.id, c]));
  const now = Date.now();
  const [low, high] = AGES[age] || [0, Infinity];

  return cases
    .map(k => ({ k, days: (now - parsed(k.opened_at)) / DAY }))
    // On the exact age: rounded, a case opened 23.5 hours ago would leave "Under a day".
    .filter(({ days }) => days >= low && days < high)
    .map(({ k, days }) => {
      const customer = byId.get(k.customer_id);

      return {
        id: k.id,
        reference: k.reference,
        status: k.status,
        openedAt: k.opened_at,
        dueAt: k.due_at,
        overdue: Boolean(k.due_at && parsed(k.due_at) < now),
        ageDays: Math.round(days * 10) / 10,
        assignedTo: k.assigned_to,
        applicant: customer?.display_name || null,
        customerReference: customer?.reference || null,
        risk: customer?.risk_rating || null,
      };
    });
}

/** Does Forest scope this key to Lagoon? Counts the cases of anyone else it can see. */
async function scopeStatus(gateway) {
  const others = await countOf(
    gateway,
    'scope',
    gateway.count('kyc_cases', {
      filter: {
        aggregator: 'Or',
        conditions: [
          leaf('partner', 'NotEqual', PARTNER),
          { field: 'partner', operator: 'Missing' },
        ],
      },
    }),
  );

  return { enforced: others === 0, others };
}

// ---- one case ----------------------------------------------------------------------------------

const starts = (text, mark) => String(text || '').startsWith(mark);

const idState = (checked, ok) => {
  if (!checked) return 'todo';

  return ok ? 'passed' : 'failed';
};

/** Where the guided flow stands, read from the evidence the way the workflow's conditions read it. */
function guide(k) {
  const closed = DECIDED.includes(k.status);
  // "Documents ·" stays empty until Check documents ran (the bank's workflow runs it first).
  const docsChecked = Boolean(k.docs_complete);
  const docsOk = starts(k.docs_complete, '✓');
  const idChecked = /^[✓✗⚠]/.test(k.idcheck_result || '');
  const idOk = starts(k.idcheck_result, '✓');
  // Empty until Screen against sanctions lists ran: no evidence is not a clear result. A hit
  // cleared before reads ○, a finished screening too.
  const screened = /^[✓✗⚠○]/.test(k.screening_result || '');
  const openHit = /✗[^·]*open/i.test(k.screening_result || '');
  const riskLow = starts(k.risk_rating_suggested, '✓');
  let advice;
  if (closed) advice = { action: null, why: `Decided: ${k.status.toLowerCase()}.` };
  else if (k.status === 'WAITING_CUSTOMER') {
    advice = { action: null, why: 'Waiting on the client: a request is out to them.' };
  } else if (idChecked && !idOk) {
    // A failed ID also leaves the file incomplete: the new ID is what to ask for.
    advice = { action: 'id', why: 'The ID check did not pass: ask for a new ID.' };
  } else if (!docsChecked) {
    advice = { action: 'check', why: 'Check the papers first (step 1).' };
  } else if (!docsOk) {
    advice = { action: 'missing', why: 'Documents missing or outdated: ask for them.' };
  } else if (!idChecked) advice = { action: 'verify', why: 'Run the ID check first (step 1).' };
  else if (!screened) {
    advice = { action: 'screen', why: 'Screen the applicant against the sanctions lists (step 2).' };
  } else if (openHit) {
    advice = { action: null, why: 'An open screening hit: the screening team decides first.' };
  } else if (riskLow) advice = { action: 'approve', why: 'Every check passed, low risk: approve.' };
  else {
    advice = {
      action: 'approve',
      why: 'Medium or high risk: approve with that rating only after a senior agrees, or reject.',
    };
  }

  return {
    closed,
    steps: {
      papers: idState(docsChecked, docsOk),
      idcheck: idState(idChecked, idOk),
      screening: screened ? (openHit ? 'hit' : 'clear') : 'todo',
      decision: closed ? 'done' : 'todo',
    },
    docsChecked,
    docsOk,
    idOk,
    openHit,
    riskLow,
    advice,
  };
}

const LABELS = { DRIVERS_LICENSE: 'Driving licence', NATIONAL_ID: 'National ID card' };

function label(code) {
  if (LABELS[code]) return LABELS[code];
  const text = String(code || '')
    .replace(/_/g, ' ')
    .toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

const checkLine = d =>
  `${label(d.document_type)}: ${d.check_result.toLowerCase()}${
    d.failure_reason ? ` (${d.failure_reason})` : ''
  }`;

function decisionLine(k) {
  if (k.status === 'APPROVED') {
    return `Approved${k.risk_after ? `, ${k.risk_after.toLowerCase()} risk` : ''}`;
  }

  return `${k.rejection_code === 'NO_RESPONSE' ? 'Closed' : 'Rejected'}: ${
    k.rejection_reason || ''
  }`;
}

/** The case's story, from its own dates and its documents (Lagoon reads no other table). */
function history(k, documents) {
  const events = [{ at: k.opened_at, what: 'Application received from Lagoon', who: 'Lagoon' }];
  documents.forEach(d => {
    events.push({
      at: d.uploaded_at,
      what: `${label(d.document_type)} received`,
      who: 'Applicant',
    });
    if (d.verified_at && d.check_result) {
      events.push({ at: d.verified_at, what: checkLine(d), who: d.verified_by });
    }
  });
  if (k.escalated_at) {
    events.push({ at: k.escalated_at, what: `Escalated: ${k.escalation_reason || ''}` });
  }
  if (k.status === 'WAITING_CUSTOMER') {
    events.push({
      at: k.updated_at,
      what: 'Waiting on the client: documents asked',
      who: k.assigned_to,
    });
  }
  if (k.resolved_at) events.push({ at: k.resolved_at, what: decisionLine(k), who: k.decided_by });

  return events.filter(e => e.at).sort((a, b) => parsed(a.at) - parsed(b.at));
}

async function caseFile(gateway, id, seen = {}) {
  const [k] = onlyLagoon(
    await rowsOf(
      gateway,
      'case',
      gateway.list('kyc_cases', {
        filter: lagoon(leaf('id', 'Equal', id)),
        projection: [...CASE_FIELDS, ...EVIDENCE_FIELDS],
        page: { limit: 1, offset: 0 },
      }),
    ),
    seen,
  );
  if (!k) return null;
  const [customers, documents] = await Promise.all([
    rowsOf(
      gateway,
      'customer',
      gateway.list('customers', {
        filter: and(leaf('partner', 'Equal', PARTNER), leaf('id', 'Equal', k.customer_id)),
        projection: [
          'id',
          'display_name',
          'reference',
          'status',
          'risk_rating',
          'partner',
          'created_at',
          'onboarded_at',
        ],
        page: { limit: 1, offset: 0 },
      }),
    ),
    rowsOf(
      gateway,
      'documents',
      gateway.related('kyc_cases', 'documents', {
        parentId: k.id,
        filter: leaf('partner', 'Equal', PARTNER),
        projection: DOCUMENT_FIELDS,
        sort: [{ field: 'uploaded_at', direction: 'asc' }],
        page: { limit: 50, offset: 0 },
      }),
    ),
  ]);
  const papers = onlyLagoon(documents, seen).map(d => ({ ...d, label: label(d.document_type) }));
  const evidence = Object.fromEntries(
    Object.entries(EVIDENCE).map(([group, list]) => [
      group,
      list.map(([name, title]) => ({ name, title, value: k[name] })),
    ]),
  );
  const own = Object.fromEntries(CASE_FIELDS.map(name => [name, k[name]]));

  return {
    case: own,
    customer: onlyLagoon(customers, seen)[0] || null,
    documents: papers,
    evidence,
    guide: guide(k),
    history: history(k, papers),
  };
}

/** Throws a 404 unless `id` is one of Lagoon's onboarding cases, read through the same filter. */
async function lagoonCase(gateway, id) {
  const rows = await rowsOf(
    gateway,
    'case',
    gateway.list('kyc_cases', {
      filter: lagoon(leaf('id', 'Equal', id)),
      projection: ['id', 'partner'],
      page: { limit: 1, offset: 0 },
    }),
  );
  if (rows[0]?.partner !== PARTNER) {
    throw Object.assign(new Error('No such Lagoon case.'), { status: 404 });
  }
}

const DATA_URI = /^data:([\w/+.-]+)(?:;name=([^;,]*))?(?:;[\w-]+=[^;,]*)*;base64,(.*)$/s;

/** One document of a Lagoon case, as the bank's agent serves its `file` field: { mime, name, buffer }. */
async function documentFile(gateway, caseId, documentId) {
  await lagoonCase(gateway, caseId);
  const [doc] = await rowsOf(
    gateway,
    'document file',
    gateway.related('kyc_cases', 'documents', {
      parentId: caseId,
      filter: and(leaf('partner', 'Equal', PARTNER), leaf('id', 'Equal', documentId)),
      projection: ['id', 'file', 'file_name', 'partner'],
      page: { limit: 1, offset: 0 },
    }),
  );
  const match = doc?.partner === PARTNER && DATA_URI.exec(doc.file || '');
  if (!match) return null;

  return {
    mime: match[1],
    name: doc.file_name || decodeURIComponent(match[2] || 'document'),
    buffer: Buffer.from(match[3], 'base64'),
  };
}

// ---- the Smart Actions -------------------------------------------------------------------------

/** The action's form as the agent fills it (defaults: the rating, the questions, the reason). */
async function actionForm(gateway, caseId, key) {
  await lagoonCase(gateway, caseId);
  const result = await gateway.form('kyc_cases', ACTIONS[key], [caseId], {});
  if (result.status !== 200) throw new GatewayError(ACTIONS[key], result, gateway);

  return (result.body.fields || []).map(f => ({
    name: f.name,
    type: f.type,
    value: f.value ?? null,
    isRequired: Boolean(f.isRequired),
    enumValues: f.enumValues || null,
  }));
}

/** Runs one action of the guided flow: { ok, message, html }. A refusal is an answer, not a crash. */
async function runAction(gateway, caseId, key, values = {}) {
  await lagoonCase(gateway, caseId);
  const result = await gateway.execute('kyc_cases', ACTIONS[key], [caseId], values);
  if (result.status === 200 && result.body?.type === 'success') {
    return { ok: true, message: result.body.message, html: result.body.html || null };
  }
  const error = result.body?.error || {};
  if (result.status === 400 && error.type === 'action_error') {
    return { ok: false, message: error.message, html: error.details?.html || null };
  }
  throw new GatewayError(ACTIONS[key], result, gateway);
}

module.exports = {
  ACTIONS,
  EVIDENCE,
  GatewayError,
  OPEN,
  PARTNER,
  actionForm,
  caseFile,
  documentFile,
  guide,
  kpis,
  lagoonCase,
  parisMonday,
  queue,
  runAction,
  scopeStatus,
  snake,
};
