/* eslint-env browser */
/**
 * Lagoon's sign-up, in the browser. It talks to Lagoon's own server only (/api/...): that server
 * holds the bank's key and calls the bank. Files go up first (/api/files), then the application.
 */
const COUNTRIES = [
  ['FR', 'France'],
  ['BE', 'Belgium'],
  ['DE', 'Germany'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['NL', 'Netherlands'],
  ['PT', 'Portugal'],
  ['LU', 'Luxembourg'],
  ['IE', 'Ireland'],
  ['AT', 'Austria'],
  ['CH', 'Switzerland'],
  ['GB', 'United Kingdom'],
  ['PL', 'Poland'],
  ['RO', 'Romania'],
  ['MA', 'Morocco'],
  ['TN', 'Tunisia'],
  ['SN', 'Senegal'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['BR', 'Brazil'],
];
const STEPS = ['welcome', 'you', 'address', 'work', 'documents', 'review', 'done'];
const DOCS = {
  id: { label: 'ID document' },
  selfie: { label: 'Selfie', type: 'SELFIE', kind: 'selfie' },
  address: { label: 'Proof of address', type: 'PROOF_OF_ADDRESS', kind: 'address' },
};
const LABELS = {
  PASSPORT: 'Passport',
  NATIONAL_ID: 'ID card',
  SELFIE: 'Selfie',
  PROOF_OF_ADDRESS: 'Proof of address',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const files = {};
let current = 0;

// ---- the applicant ------------------------------------------------------------------------------

function values() {
  const out = {};
  ['you', 'address', 'work', 'documents'].forEach(name => {
    $$('input, select', $(`[data-step="${name}"]`)).forEach(field => {
      if (!field.name || field.type === 'file') return;
      if (field.type === 'checkbox') out[field.name] = field.checked;
      else if (field.type === 'radio') {
        if (field.checked) out[field.name] = field.value;
      } else out[field.name] = field.value.trim();
    });
  });

  return out;
}

function fill(data) {
  Object.entries(data).forEach(([name, value]) => {
    $$(`[name="${name}"]`).forEach(field => {
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else if (field.type === 'radio') field.checked = field.value === value;
      else field.value = value;
    });
  });
}

const country = code => COUNTRIES.find(([c]) => c === code)?.[1] || code;
const money = n => `€${Number(n || 0).toLocaleString('en-GB')}`;

function summarize() {
  const v = values();
  const rows = [
    ['Name', `${v.firstName} ${v.lastName}${v.birthName ? ` (born ${v.birthName})` : ''}`],
    [
      'Born',
      `${v.dateOfBirth}${v.placeOfBirth ? `, ${v.placeOfBirth}` : ''} · ${country(v.nationality)}`,
    ],
    ['Contact', `${v.email} · ${v.phone}`],
    [
      'Address',
      `${v.address}${v.address2 ? `, ${v.address2}` : ''}, ${v.postalCode} ${v.city}, ${country(
        v.country,
      )}`,
    ],
    ['Work', `${v.occupation}${v.employer ? ` at ${v.employer}` : ''}`],
    ['Per month', `${money(v.monthlyIn)} in · ${money(v.monthlyOut)} out`],
    [
      'Documents',
      Object.entries(files)
        .map(([key, f]) => `${key === 'id' ? LABELS[v.idType] : DOCS[key].label}: ${f.name}`)
        .join(' · '),
    ],
  ];
  const summary = $('#summary');
  summary.replaceChildren(
    ...rows.flatMap(([term, detail]) => {
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = detail;

      return [dt, dd];
    }),
  );
}

// ---- steps ---------------------------------------------------------------------------------------

function show(index) {
  current = index;
  $$('.step').forEach(step => step.classList.toggle('on', step.dataset.step === STEPS[index]));
  const progress = $('#progress');
  progress.hidden = index === 0 || index === STEPS.length - 1;
  $$('li', progress).forEach((li, i) => li.classList.toggle('on', i < index));
  if (STEPS[index] === 'review') summarize();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stepValid(step) {
  if (step.tagName === 'FORM' && !step.reportValidity()) return false;
  if (step.dataset.step === 'documents') {
    const missing = Object.keys(DOCS).find(key => !files[key]);
    if (missing) {
      const note = $('#doc-error');
      note.textContent = `Please add your ${DOCS[missing].label.replace(/^(?!ID)./, c =>
        c.toLowerCase(),
      )}.`;
      note.hidden = false;

      return false;
    }
  }

  return true;
}

// ---- files --------------------------------------------------------------------------------------

function showFile(fieldset, file) {
  const drop = $('.drop', fieldset);
  drop.classList.add('ok');
  const label = $('.file', drop);
  const link = document.createElement('a');
  link.href = file.url.replace(/^https?:\/\/[^/]+/, '');
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = file.name;
  label.replaceChildren('✓ ', link, ` · ${Math.max(1, Math.round(file.size / 1024))} KB`);
}

async function upload(fieldset, file) {
  $('.file', fieldset).textContent = 'Uploading…';
  const response = await fetch('/api/files', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': file.name },
    body: file,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Upload failed');

  return body;
}

async function useSample(fieldset, flawed) {
  const key = fieldset.dataset.doc;
  const v = values();
  const idKind = v.idType === 'NATIONAL_ID' ? 'national_id' : 'passport';
  const kind = key === 'id' ? idKind : DOCS[key].kind;
  $('.file', fieldset).textContent = 'Drawing a sample…';
  const response = await fetch('/api/samples', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      flawed,
      person: { ...v, number: v.idNumber, expires: v.idExpires },
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No sample');

  return body;
}

/** A sample ID needs a number and an expiry date: made up when the customer left them empty. */
function idDefaults() {
  const v = values();
  const letters = v.lastName
    .normalize('NFD')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase();
  const digits = String(Math.floor(Math.random() * 1e5)).padStart(5, '0');
  if (!v.idNumber)
    fill({ idNumber: `${20 + Math.floor(Math.random() * 6)}${letters || 'AB'}${digits}` });
  if (!v.idExpires) fill({ idExpires: `${new Date().getFullYear() + 6}-09-30` });
}

function wireDocuments() {
  $$('fieldset.doc').forEach(fieldset => {
    const key = fieldset.dataset.doc;
    const keep = async promise => {
      try {
        files[key] = await promise;
        showFile(fieldset, files[key]);
        $('#doc-error').hidden = true;
      } catch (error) {
        delete files[key];
        $('.drop', fieldset).classList.remove('ok');
        $('.file', fieldset).textContent = error.message;
      }
    };
    $('input[type=file]', fieldset).addEventListener('change', event => {
      const [file] = event.target.files;
      if (file) keep(upload(fieldset, file));
    });
    $$('[data-sample]', fieldset).forEach(button =>
      button.addEventListener('click', () => {
        if (key === 'id') idDefaults();
        keep(useSample(fieldset, button.dataset.sample === 'flawed'));
      }),
    );
  });
}

// ---- sending --------------------------------------------------------------------------------------

async function send(event) {
  event.preventDefault();
  const step = $('[data-step="review"]');
  if (!step.reportValidity()) return;
  const button = $('#send');
  const error = $('#error');
  error.hidden = true;
  button.disabled = true;
  button.textContent = 'Sending to our bank…';
  const v = values();
  const documents = [
    { type: v.idType, fileId: files.id.id, number: v.idNumber, expires: v.idExpires },
    { type: 'SELFIE', fileId: files.selfie.id },
    { type: 'PROOF_OF_ADDRESS', fileId: files.address.id },
  ];

  try {
    const response = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicant: v, documents }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The application could not be sent.');
    $('#done-name').textContent = v.firstName;
    $('#done-ref').textContent = body.reference;
    $('#done-docs').replaceChildren(
      ...body.documents.map(d => {
        const li = document.createElement('li');
        li.textContent = `${d.ok ? '✓' : '✗'} ${LABELS[d.type] || d.type}${
          d.ok ? ' received' : ` not received: ${d.error || d.status}`
        }`;
        if (!d.ok) li.className = 'bad';

        return li;
      }),
    );
    $('#done-bank').textContent = `Bank case ${body.caseReference} · Forest Lab Bank`;
    // The other side: the case this application opened in the bank's Forest.
    $('#done-forest').hidden = !body.forestUrl;
    if (body.forestUrl) {
      $('#done-case').textContent = body.caseReference;
      $('#done-forest-link').href = body.forestUrl;
    }
    show(STEPS.indexOf('done'));
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Send my application';
  }
}

// ---- demo helpers ---------------------------------------------------------------------------------

const FIRST = [
  'Camille',
  'Léa',
  'Inès',
  'Jade',
  'Chloé',
  'Hugo',
  'Louis',
  'Nathan',
  'Théo',
  'Manon',
  'Lucas',
  'Sarah',
];
const LAST = [
  'Rousseau',
  'Lefèvre',
  'Fontaine',
  'Chevalier',
  'Morel',
  'Girard',
  'Lambert',
  'Bonnet',
  'Mercier',
  'Blanchard',
  'Garnier',
  'Faure',
];
const STREETS = [
  ['rue de la Roquette', '75011', 'Paris'],
  ['rue Oberkampf', '75011', 'Paris'],
  ['cours Gambetta', '69007', 'Lyon'],
  ['rue Sainte-Catherine', '33000', 'Bordeaux'],
  ['rue de la République', '13002', 'Marseille'],
  ['rue Crébillon', '44000', 'Nantes'],
];
const JOBS = [
  ['Product designer', 'Atelier Nord', 'FROM_40K_TO_70K', 3400],
  ['Nurse', 'AP-HP', 'FROM_20K_TO_40K', 2300],
  ['Software engineer', 'Doctolib', 'FROM_40K_TO_70K', 3900],
  ['Teacher', 'Éducation nationale', 'FROM_20K_TO_40K', 2400],
  ['Sales manager', 'Decathlon', 'FROM_40K_TO_70K', 3600],
];
const pick = list => list[Math.floor(Math.random() * list.length)];
const pad = n => String(n).padStart(2, '0');

function demoCustomer() {
  const first = pick(FIRST);
  const last = pick(LAST);
  const [street, postal, city] = pick(STREETS);
  const [job, employer, band, monthly] = pick(JOBS);
  const plain = s =>
    s
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();
  const year = 1975 + Math.floor(Math.random() * 30);

  return {
    firstName: first,
    lastName: last,
    birthName: '',
    dateOfBirth: `${year}-${pad(1 + Math.floor(Math.random() * 12))}-${pad(
      1 + Math.floor(Math.random() * 28),
    )}`,
    placeOfBirth: pick(['Paris', 'Lyon', 'Lille', 'Toulouse', 'Rennes']),
    nationality: 'FR',
    email: `${plain(first)}.${plain(last)}${Math.floor(Math.random() * 90) + 10}@example.com`,
    phone: `+33 6 ${pad(Math.floor(Math.random() * 100))} ${pad(
      Math.floor(Math.random() * 100),
    )} ${pad(Math.floor(Math.random() * 100))} ${pad(Math.floor(Math.random() * 100))}`,
    address: `${1 + Math.floor(Math.random() * 120)} ${street}`,
    address2: '',
    postalCode: postal,
    city,
    country: 'FR',
    taxId: String(Math.floor(1e12 + Math.random() * 9e12)),
    usPerson: false,
    employmentStatus: 'EMPLOYED',
    occupation: job,
    employer,
    incomeBand: band,
    sourceOfFunds: 'SALARY',
    sourceOfWealth: 'Salary savings',
    monthlyIn: monthly,
    monthlyOut: Math.round((monthly * 0.85) / 50) * 50,
    idType: 'PASSPORT',
    idNumber: `${20 + Math.floor(Math.random() * 6)}${plain(last)
      .slice(0, 2)
      .toUpperCase()}${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`,
    idExpires: `${new Date().getFullYear() + 3 + Math.floor(Math.random() * 6)}-${pad(
      1 + Math.floor(Math.random() * 12),
    )}-15`,
  };
}

// ---- start --------------------------------------------------------------------------------------

function start() {
  $$('[data-countries]').forEach(select => {
    select.replaceChildren(
      ...COUNTRIES.map(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;

        return option;
      }),
    );
  });
  $$('[data-next]').forEach(button =>
    button.addEventListener('click', event => {
      event.preventDefault();
      if (stepValid(button.closest('.step'))) show(current + 1);
    }),
  );
  $$('[data-back]').forEach(button => button.addEventListener('click', () => show(current - 1)));
  $('[data-step="review"]').addEventListener('submit', send);
  $('#demo-fill').addEventListener('click', () => {
    fill(demoCustomer());
    show(1);
  });
  $('#again').addEventListener('click', () => window.location.reload());
  wireDocuments();
  show(0);
  fetch('/api/status')
    .then(r => r.json())
    .then(({ bank }) => {
      const badge = $('#bank-status');
      badge.textContent = `Partner bank: ${bank === 'ready' ? 'connected' : 'not reachable'}`;
      badge.classList.add(bank === 'ready' ? 'ready' : 'down');
    })
    .catch(() => undefined);
}

start();
