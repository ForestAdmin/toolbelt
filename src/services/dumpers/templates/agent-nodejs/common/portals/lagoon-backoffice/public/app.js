/* eslint-env browser */
/**
 * Lagoon's onboarding back office, in the browser. It talks to its own server only (/api/...):
 * that server holds the bank's key and calls the bank's Gateway API.
 */
(() => {
  const view = document.getElementById('view');
  const STATUS = {
    OPEN: ['New', 'blue'],
    IN_REVIEW: ['In review', 'teal'],
    WAITING_CUSTOMER: ['Waiting on the client', 'amber'],
    PENDING_APPROVAL: ['Senior sign-off', 'amber'],
    ESCALATED: ['With screening', 'coral'],
    APPROVED: ['Approved', 'green'],
    REJECTED: ['Rejected', 'red'],
  };
  const AGES = [
    ['', 'Any age'],
    ['new', 'Under a day'],
    ['days', '1 to 3 days'],
    ['late', 'Over 3 days'],
  ];
  const ACTION_LABELS = {
    approve: 'Approve KYC',
    missing: 'Request missing documents',
    id: 'Request ID document',
    reject: 'Reject KYC',
  };
  const CHECK_MARK = { PASSED: '✓', FAILED: '✗' };
  const STEP_TONES = {
    passed: 'ok',
    clear: 'ok',
    done: 'ok',
    failed: 'bad',
    hit: 'bad',
    todo: 'idle',
  };
  const STEP_WORDS = {
    passed: 'Passed',
    clear: 'No open hit',
    done: 'Decided',
    failed: 'Did not pass',
    hit: 'Open hit',
    todo: 'To do',
  };
  const state = { filters: { status: '', age: '' }, results: {} };
  // Filled below; the action buttons call back into the case page.
  const pages = {};

  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );
  const when = value =>
    value
      ? new Date(String(value).replace(' ', 'T')).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        })
      : '—';
  const age = days =>
    days < 1 ? `${Math.max(1, Math.round(days * 24))} h` : `${Math.round(days * 10) / 10} d`;
  const person = email => String(email || '').split('@')[0];
  const badge = code => {
    const [text, tone] = STATUS[code] || [code, 'grey'];

    return `<span class="badge ${tone}">${esc(text)}</span>`;
  };
  // ✓ ✗ ⚠ ○ at the start of an evidence line give its tone.
  const tone = text =>
    ({ '✓': 'ok', '✗': 'bad', '⚠': 'look', '○': 'idle' }[String(text || '').trim()[0]] || 'idle');
  const checkTone = result => tone(result ? CHECK_MARK[result] || '⚠' : '○');

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'content-type': 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Error ${response.status}`);

    return body;
  }

  // Rows of another partner never show: the server drops them. Say so if it ever had to.
  function warn(hidden) {
    const box = document.getElementById('warning');
    box.hidden = !hidden;
    box.textContent = hidden
      ? `${hidden} rows of other partners were hidden by the back office.`
      : '';
  }

  function pill(id, text, on) {
    const element = document.getElementById(id);
    element.textContent = text;
    element.className = `pill ${on ? 'on' : 'off'}`;
  }

  async function bankStatus() {
    try {
      const s = await api('/api/status');
      pill('bank', `Bank: ${s.bank}`, s.bank === 'ready');
      // Lagoon only: by a Forest scope on a dedicated key, or by the server's own filter.
      pill('scope', s.scope?.enforced ? 'Forest scope: Lagoon only' : 'Filter: Lagoon only', true);
    } catch {
      pill('bank', 'Bank: unreachable', false);
    }
  }

  // ---- home -----------------------------------------------------------------------------------

  const tile = (label, value, hint, cls = '') =>
    `<div class="tile ${cls}"><div class="tile-label">${esc(label)}</div>
      <div class="tile-value">${esc(value ?? '—')}</div><div class="tile-hint">${esc(
      hint,
    )}</div></div>`;

  const chips = (name, options) =>
    options
      .map(
        ([value, text]) =>
          `<button class="chip ${
            state.filters[name] === value ? 'on' : ''
          }" data-filter="${name}" data-value="${value}">${esc(text)}</button>`,
      )
      .join('');

  function tiles(k) {
    return `<section class="tiles">
      ${tile('Backlog', k.backlog, 'open applications')}
      ${tile('Done this week', k.doneWeek, 'decided since Monday')}
      ${tile(
        'Done in 30 days',
        k.done30,
        `${k.approved30} approved · ${k.refused30} refused · ${k.closed30} closed`,
      )}
      ${tile(
        'Median time to decide',
        k.medianDays === null ? '—' : `${k.medianDays} d`,
        'application to decision, 30 days',
      )}
      ${tile(
        'Approval rate',
        k.approvalRate === null ? '—' : `${k.approvalRate}%`,
        'approved vs refused, 30 days',
      )}
      ${tile('Waiting on the client', k.waiting, 'documents asked', k.waiting ? 'amber' : '')}
    </section>`;
  }

  const queueRow = c => `<tr data-case="${esc(c.id)}">
      <td><a href="#/case/${esc(c.id)}">${esc(c.reference)}</a></td>
      <td>${esc(c.applicant || '—')}<div class="sub">${esc(c.customerReference || '')}</div></td>
      <td>${badge(c.status)}</td>
      <td class="num ${c.ageDays > 3 ? 'late' : ''}">${age(c.ageDays)}</td>
      <td class="${c.overdue ? 'late' : ''}">${when(c.dueAt)}${c.overdue ? ' · overdue' : ''}</td>
      <td>${esc(person(c.assignedTo) || '—')}</td>
    </tr>`;

  function bindHome() {
    view.querySelectorAll('[data-filter]').forEach(button =>
      button.addEventListener('click', () => {
        state.filters[button.dataset.filter] = button.dataset.value;
        pages.home();
      }),
    );
    view.querySelectorAll('tr[data-case]').forEach(row =>
      row.addEventListener('click', event => {
        if (event.target.tagName !== 'A') window.location.hash = `#/case/${row.dataset.case}`;
      }),
    );
  }

  pages.home = async () => {
    view.innerHTML = '<p class="muted">Loading the queue…</p>';
    const query = new URLSearchParams(
      Object.entries(state.filters).filter(([, v]) => v),
    ).toString();
    let data;

    try {
      data = await api(`/api/home${query ? `?${query}` : ''}`);
    } catch (error) {
      view.innerHTML = `<div class="card error">${esc(error.message)}</div>`;

      return;
    }
    warn(data.hidden);
    const statuses = ['OPEN', 'IN_REVIEW', 'WAITING_CUSTOMER'].map(s => [s, STATUS[s][0]]);
    view.innerHTML = `${tiles(data.kpis)}
      <section class="card">
        <div class="card-head">
          <h2>Queue <span class="count">${data.queue.length}</span></h2>
          <div class="filters">${chips('status', [['', 'All open'], ...statuses])}
            <span class="sep"></span>${chips('age', AGES)}</div>
        </div>
        <table class="queue">
          <thead><tr><th>Case</th><th>Applicant</th><th>Status</th><th>Age</th><th>Due</th><th>Owner</th></tr></thead>
          <tbody>${
            data.queue.map(queueRow).join('') ||
            '<tr><td colspan="6" class="muted">Nothing open with these filters.</td></tr>'
          }</tbody>
        </table>
        <p class="foot muted">Oldest first. Every row comes from the bank's agent through Forest's Gateway API, filtered on partner = Lagoon.</p>
      </section>`;
    bindHome();
  };

  // ---- a case: its parts ----------------------------------------------------------------------

  const lines = list =>
    `<dl class="evidence">${list
      .map(e => `<dt>${esc(e.title)}</dt><dd class="${tone(e.value)}">${esc(e.value || '—')}</dd>`)
      .join('')}</dl>`;

  function resultCard(slot) {
    const result = state.results[slot];
    if (!result) return '';
    const frame = result.html
      ? `<iframe class="result-frame" sandbox="allow-same-origin" srcdoc="${esc(
          result.html,
        )}"></iframe>`
      : '';

    return `<div class="result ${result.ok ? 'ok' : 'bad'}"><div class="result-msg">${
      result.ok ? 'Done' : 'Refused'
    }: ${esc(result.message || '')}</div>${frame}</div>`;
  }

  const stepCard = (n, title, stepState, body, slot) => `<section class="step">
      <div class="step-head"><span class="step-n">${n}</span><h3>${esc(title)}</h3>
        ${
          stepState
            ? `<span class="state ${STEP_TONES[stepState]}">${STEP_WORDS[stepState]}</span>`
            : ''
        }</div>
      ${body}${slot ? resultCard(slot) : ''}</section>`;

  const runButton = (key, label, primary, disabled) =>
    `<button class="btn ${primary ? 'primary' : ''}" data-run="${key}" ${
      disabled ? 'disabled' : ''
    }>${esc(label)}</button>`;

  function documentsBlock(documents) {
    if (!documents.length) return '<p class="muted">No document received yet.</p>';
    const items = documents
      .map(
        d => `<li><button class="doc" data-doc="${esc(d.id)}">
          <span class="doc-type">${esc(d.label)}</span>
          <span class="doc-name">${esc(d.file_name || '')}</span>
          <span class="doc-check ${checkTone(d.check_result)}">${esc(
          d.check_result ? d.check_result.toLowerCase().replace('_', ' ') : 'not checked',
        )}</span></button></li>`,
      )
      .join('');

    return `<ul class="docs">${items}</ul>
      <div class="preview" id="preview" hidden><div class="preview-head"><span id="preview-name"></span>
      <a id="preview-open" target="_blank" rel="noopener">Open</a></div><iframe id="preview-frame" title="Document"></iframe></div>`;
  }

  function actionStep(data) {
    const k = data.case;
    const g = data.guide;
    if (g.closed) {
      const forest = data.forestActivityUrl
        ? `<div class="forest-link"><p><strong>Done, and on record at the bank.</strong> Every step you ran here went through the bank's Smart Actions: Forest logged each one, with who ran it, in the case's Activity tab.</p><a href="${esc(
            data.forestActivityUrl,
          )}" target="_blank" rel="noopener">See the audit trail in Forest →</a></div>`
        : '';

      return `<p class="muted">Decided by ${esc(k.decided_by || '—')} on ${when(
        k.resolved_at,
      )}.</p>${forest}`;
    }
    const buttons = Object.entries(ACTION_LABELS)
      .map(([key, label]) => runButton(key, label, g.advice.action === key, false))
      .join('');
    const waiting =
      k.status === 'WAITING_CUSTOMER'
        ? '<p class="muted">The case waits on the client: a new action is still possible.</p>'
        : '';

    return `<div class="buttons">${buttons}</div><div id="form-box"></div>${waiting}`;
  }

  function guidedSteps(data) {
    const g = data.guide;
    const ev = data.evidence;
    const advice = g.advice.action
      ? `Suggested: ${esc(ACTION_LABELS[g.advice.action] || g.advice.action)}`
      : 'No action now';
    const step1 = `${lines([...ev.documents.slice(1, 3), ...ev.idcheck])}
      <div class="buttons">${runButton(
        'check',
        'Run Check documents',
        g.advice.action === 'check',
        g.closed || g.docsChecked,
      )}${runButton(
      'verify',
      'Run Verify document',
      g.advice.action === 'verify',
      g.closed || !g.docsChecked || g.steps.idcheck !== 'todo',
    )}</div>`;
    const step2 = `${lines(ev.screening)}
      <div class="buttons">${runButton(
        'screen',
        'Run Screen against sanctions lists',
        g.steps.idcheck === 'passed' && !g.closed,
        g.closed,
      )}</div>`;
    const titled = (e, title) => ({ ...e, title });
    const summary = [
      titled(ev.documents[0], 'Documents complete'),
      titled(ev.idcheck[0], 'ID check'),
      titled(ev.screening[0], 'Screening'),
      ...ev.risk,
    ];
    const step3 = `${lines(summary)}
      <div class="advice ${g.advice.action ? '' : 'idle'}"><strong>${advice}</strong> · ${esc(
      g.advice.why,
    )}</div>`;

    return `<h2 class="col-title">Guided review <span class="muted">· the steps of the bank's retail onboarding workflow</span></h2>
      ${stepCard(
        1,
        'Check the papers, the ID and the selfie',
        g.docsChecked ? g.steps.idcheck : 'todo',
        step1,
        'verify',
      )}
      ${stepCard(
        2,
        'Screening',
        g.steps.idcheck === 'todo' ? null : g.steps.screening,
        step2,
        'screen',
      )}
      ${stepCard(3, 'The decision, on the evidence', null, step3)}
      ${stepCard(4, 'The action', g.closed ? 'done' : 'todo', actionStep(data), 'action')}`;
  }

  function caseHeader(data) {
    const k = data.case;
    const customer = data.customer || {};

    return `<p class="crumbs"><a href="#/">← Queue</a></p>
      <section class="case-head card">
        <div><div class="eyebrow">${esc(k.notes || 'Lagoon application')}</div>
          <h1>${esc(customer.display_name || 'Applicant')} <span class="ref">${esc(
      k.reference,
    )}</span></h1>
          <div class="meta">${badge(k.status)} · applied ${when(k.opened_at)} · due ${when(
      k.due_at,
    )} · owner ${esc(person(k.assigned_to) || 'nobody yet')} · ${esc(
      customer.reference || '',
    )}</div></div>
        <button class="btn" id="refresh">Refresh</button>
      </section>`;
  }

  function sidePanel(data) {
    const events = data.history
      .map(
        e =>
          `<li><span class="t">${when(e.at)}</span> ${esc(e.what)}${
            e.who ? ` <span class="muted">· ${esc(person(e.who))}</span>` : ''
          }</li>`,
      )
      .join('');

    return `<section class="card"><h2>Applicant</h2>${lines(data.evidence.applicant)}</section>
      <section class="card"><h2>Documents</h2>${documentsBlock(data.documents)}</section>
      <section class="card"><h2>History</h2><ol class="timeline">${events}</ol></section>`;
  }

  // ---- a case: forms and actions --------------------------------------------------------------

  async function run(id, key, values, slot) {
    view.querySelectorAll('button').forEach(b => {
      b.disabled = true;
    });
    const busy = view.querySelector(`[data-run="${key}"]`);
    if (busy) busy.textContent = 'Running…';

    try {
      state.results[slot] = await api(`/api/cases/${id}/actions/${key}`, {
        method: 'POST',
        body: JSON.stringify({ values }),
      });
    } catch (error) {
      state.results[slot] = { ok: false, message: error.message };
    }
    await pages.showCase(id, true);
  }

  // A rating the agent leaves empty starts from the one the case file suggests (step 3).
  const fallback = f =>
    f.name === 'Risk rating'
      ? /\b(LOW|MEDIUM|HIGH)\b/.exec(state.suggested || '')?.[1] || null
      : null;

  function input(f) {
    const name = esc(f.name);
    const required = f.isRequired ? 'required' : '';
    if (f.enumValues) {
      const options = f.enumValues
        .map(v => `<option ${v === (f.value ?? fallback(f)) ? 'selected' : ''}>${esc(v)}</option>`)
        .join('');

      return `<select name="${name}" ${required}><option value=""></option>${options}</select>`;
    }
    if (/reason|questions|note/i.test(f.name)) {
      return `<textarea name="${name}" rows="4" ${required}>${esc(f.value || '')}</textarea>`;
    }

    return `<input name="${name}" value="${esc(f.value || '')}" ${required} />`;
  }

  async function openForm(id, key, box) {
    box.innerHTML = '<p class="muted">Loading the form…</p>';
    let fields;

    try {
      ({ fields } = await api(`/api/cases/${id}/actions/${key}`));
    } catch (error) {
      box.innerHTML = `<p class="error">${esc(error.message)}</p>`;

      return;
    }
    box.innerHTML = `<form class="action-form">${fields
      .map(f => `<label>${esc(f.name)}${f.isRequired ? ' *' : ''}${input(f)}</label>`)
      .join('')}${fields.length ? '' : '<p class="muted">No field: it runs as is.</p>'}
      <div class="form-buttons"><button class="btn primary" type="submit">Run ${esc(
        ACTION_LABELS[key],
      )}</button>
      <button class="btn" type="button" data-cancel>Cancel</button></div></form>`;
    box.querySelector('[data-cancel]').addEventListener('click', () => {
      box.innerHTML = '';
    });
    box.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const values = {};
      new FormData(event.target).forEach((value, name) => {
        if (value !== '') values[name] = value;
      });
      run(id, key, values, 'action');
    });
  }

  function previewDocument(id, button) {
    const url = `/api/cases/${id}/documents/${button.dataset.doc}`;
    view.querySelector('#preview').hidden = false;
    view.querySelector('#preview-frame').src = url;
    view.querySelector('#preview-open').href = url;
    view.querySelector('#preview-name').textContent = button.querySelector('.doc-type').textContent;
  }

  function bindCase(id) {
    view.querySelector('#refresh').addEventListener('click', () => pages.showCase(id, true));
    view.querySelectorAll('[data-run]').forEach(button =>
      button.addEventListener('click', () => {
        const key = button.dataset.run;
        // Step 1's two checks share its result slot; screening has its own.
        if (key === 'check') run(id, key, {}, 'verify');
        else if (key === 'verify' || key === 'screen') run(id, key, {}, key);
        else openForm(id, key, view.querySelector('#form-box'));
      }),
    );
    view
      .querySelectorAll('[data-doc]')
      .forEach(button => button.addEventListener('click', () => previewDocument(id, button)));
    view.querySelectorAll('.result-frame').forEach(frame => {
      frame.addEventListener('load', () => {
        const height = frame.contentDocument?.documentElement?.scrollHeight;
        if (height) Object.assign(frame.style, { height: `${height + 4}px` });
      });
    });
  }

  pages.showCase = async (id, keepResults = false) => {
    if (!keepResults) {
      state.results = {};
      view.innerHTML = '<p class="muted">Loading the case…</p>';
    }
    let data;

    try {
      data = await api(`/api/cases/${id}`);
    } catch (error) {
      view.innerHTML = `<p><a href="#/">← Queue</a></p><div class="card error">${esc(
        error.message,
      )}</div>`;

      return;
    }
    warn(data.hidden);
    state.suggested = data.evidence.risk[0]?.value;
    view.innerHTML = `${caseHeader(data)}
      <div class="columns"><div class="col-main">${guidedSteps(data)}</div>
        <aside class="col-side">${sidePanel(data)}</aside></div>`;
    bindCase(id);
  };

  function router() {
    const match = /^#\/case\/([\w-]+)/.exec(window.location.hash);
    window.scrollTo(0, 0);
    if (match) pages.showCase(match[1]);
    else pages.home();
  }

  window.addEventListener('hashchange', router);
  bankStatus();
  router();
})();
