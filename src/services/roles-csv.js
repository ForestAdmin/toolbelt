/**
 * Wide role-centric CSV helpers for `forest roles:export` / `forest roles:apply`.
 * PRD-535.
 */

const CRUD_SUFFIXES = ['browse', 'read', 'add', 'edit', 'delete', 'export'];
const SMART_ACTION_SUFFIXES = [
  'trigger',
  'approvalRequired',
  'userApproval',
  'selfApproval',
  'hasConditions',
];
const SMART_ACTION_WRITE_SUFFIXES = ['trigger', 'approvalRequired', 'userApproval', 'selfApproval'];

const CRUD_FIELD_MAP = {
  browse: 'browseEnabled',
  read: 'readEnabled',
  add: 'addEnabled',
  edit: 'editEnabled',
  delete: 'deleteEnabled',
  export: 'exportEnabled',
};

const SA_FIELD_MAP = {
  trigger: 'triggerEnabled',
  approvalRequired: 'approvalRequired',
  userApproval: 'userApprovalEnabled',
  selfApproval: 'selfApprovalEnabled',
};

// Derived from the maps so the diff field lists can't drift from the column maps.
const CRUD_FIELDS = Object.values(CRUD_FIELD_MAP);
const SA_FIELDS = Object.values(SA_FIELD_MAP);

// ---------------------------------------------------------------------------
// Internal CSV helpers (no external library)
// ---------------------------------------------------------------------------

function escapeCsv(value) {
  const str = String(value == null ? '' : value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvCharacters(line) {
  return line.split('').reduce(
    (acc, ch, i) => {
      if (acc.inQuotes) {
        // Consume the second quote of an escaped pair (`""`) before treating
        // `"` as a section delimiter, otherwise it closes the quotes early.
        if (acc.skipNext) return { ...acc, skipNext: false };
        if (ch === '"') {
          if (line[i + 1] === '"') {
            return { ...acc, current: `${acc.current}"`, skipNext: true };
          }
          return { ...acc, inQuotes: false };
        }
        return { ...acc, current: acc.current + ch };
      }
      if (ch === '"') return { ...acc, inQuotes: true };
      if (ch === ',') return { ...acc, fields: [...acc.fields, acc.current], current: '' };
      return { ...acc, current: acc.current + ch };
    },
    { fields: [], current: '', inQuotes: false, skipNext: false },
  );
}

function parseCsvLine(line) {
  const result = parseCsvCharacters(line);
  return [...result.fields, result.current];
}

function parseBool(value) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Invalid boolean value "${value}" in CSV (expected "true" or "false").`);
}

// ---------------------------------------------------------------------------
// Build the ordered column list from a set of roles (for formatWide)
// ---------------------------------------------------------------------------

function collectSmartActionsForCollection(roles, envId, colName) {
  const actionSet = new Set();
  roles.forEach(role => {
    const envPerms = (role.permissions.environments || []).find(
      e => String(e.environmentId ?? e.id) === String(envId),
    );
    if (!envPerms) return;
    const col = (envPerms.collections || []).find(c => c.collectionName === colName);
    if (!col) return;
    (col.smartActions || []).forEach(sa => actionSet.add(sa.smartActionName));
  });
  return Array.from(actionSet).sort();
}

function collectColumns(collections, roles, envId) {
  return collections.reduce((cols, colName) => {
    const crudCols = CRUD_SUFFIXES.map(s => ({
      header: `${colName}:${s}`,
      collectionName: colName,
      suffix: s,
    }));
    const actions = collectSmartActionsForCollection(roles, envId, colName);
    const saCols = actions.reduce(
      (acc, action) => [
        ...acc,
        ...SMART_ACTION_SUFFIXES.map(s => ({
          header: `${colName}:${action}:${s}`,
          collectionName: colName,
          actionName: action,
          suffix: s,
        })),
      ],
      [],
    );
    return [...cols, ...crudCols, ...saCols];
  }, []);
}

/**
 * The sorted collection names the roles grant anything on in this environment.
 * @param {Array} roles
 * @param {string|number} envId
 * @returns {string[]}
 */
function collectionNamesOf(roles, envId) {
  const collectionSet = new Set();
  roles.forEach(role => {
    const envPerms = (role.permissions.environments || []).find(
      e => String(e.environmentId ?? e.id) === String(envId),
    );
    if (!envPerms) return;
    (envPerms.collections || []).forEach(col => collectionSet.add(col.collectionName));
  });
  return Array.from(collectionSet).sort();
}

function buildColumns(roles, envId) {
  return collectColumns(collectionNamesOf(roles, envId), roles, envId);
}

/**
 * Each collection the roles grant anything on in this environment, with the smart
 * actions they carry on it.
 * @param {Array} roles
 * @param {string|number} envId
 * @returns {Map<string, Set<string>>}
 */
function environmentCollectionsOf(roles, envId) {
  return new Map(
    collectionNamesOf(roles, envId).map(name => [
      name,
      new Set(collectSmartActionsForCollection(roles, envId, name)),
    ]),
  );
}

function booleanFields(source, fields) {
  return Object.fromEntries(fields.map(field => [field, Boolean(source[field])]));
}

/**
 * The roles' permissions in this environment, in the shape parseWide returns. Built
 * from the roles themselves: re-parsing their own export would have to guess where a
 * colon-named collection ends, which the roles already say.
 * @param {Array} roles
 * @param {string|number} envId
 */
function currentStateOf(roles, envId) {
  return roles.map(role => {
    const envPerms = (role.permissions.environments || []).find(
      e => String(e.environmentId ?? e.id) === String(envId),
    );
    return {
      name: role.name,
      enabled: Boolean(envPerms?.enabled),
      envId: String(envId),
      collections: (envPerms?.collections || []).map(col => ({
        collectionName: col.collectionName,
        ...booleanFields(col, CRUD_FIELDS),
        smartActions: (col.smartActions || []).map(sa => ({
          smartActionName: sa.smartActionName,
          ...booleanFields(sa, SA_FIELDS),
        })),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// formatWide helpers
// ---------------------------------------------------------------------------

function getCrudValue(col, suffix) {
  if (!col) return false;
  return Boolean(col[CRUD_FIELD_MAP[suffix]]);
}

function getSmartActionValue(col, actionName, suffix) {
  if (!col) return false;
  const sa = (col.smartActions || []).find(a => a.smartActionName === actionName);
  if (!sa) return false;
  if (suffix === 'hasConditions') {
    return (
      sa.triggerCondition != null ||
      sa.approvalRequiredCondition != null ||
      sa.userApprovalCondition != null
    );
  }
  return Boolean(sa[SA_FIELD_MAP[suffix]]);
}

// Reads the structured column descriptor built by collectColumns rather than
// re-splitting its `header`: a smart-action name may itself contain a colon
// (e.g. "SAML SSO #2: Edit SSO config"), which a split would mis-slice.
function buildCellForColumn(column, colByName) {
  const col = colByName[column.collectionName];
  if (column.actionName === undefined) return String(getCrudValue(col, column.suffix));
  return String(getSmartActionValue(col, column.actionName, column.suffix));
}

function buildRoleRow(role, columns, envId) {
  const envPerms = (role.permissions.environments || []).find(
    e => String(e.environmentId ?? e.id) === String(envId),
  );
  const enabled = envPerms ? Boolean(envPerms.enabled) : false;
  const colByName = {};
  if (envPerms) {
    (envPerms.collections || []).forEach(col => {
      colByName[col.collectionName] = col;
    });
  }
  const cells = [role.name, String(enabled), ...columns.map(h => buildCellForColumn(h, colByName))];
  return cells.map(escapeCsv).join(',');
}

/**
 * Format an array of full role objects into a wide CSV string.
 * @param {Array<{ id: string, name: string, permissions: { environments: Array } }>} roles
 * @param {string|number} envId
 * @returns {string}
 */
function formatWide(roles, envId) {
  const columns = buildColumns(roles, envId);
  const header = ['role', 'enabled', ...columns.map(c => c.header)].map(escapeCsv).join(',');
  const rows = [header, ...roles.map(role => buildRoleRow(role, columns, envId))];
  return `${rows.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// parseWide helpers
// ---------------------------------------------------------------------------

// A permission field is set only when the CSV has its column: computeDiff leaves an
// absent field alone, so a CSV that omits a column never revokes it.
function emptyCollection(colName) {
  return { collectionName: colName, smartActions: [] };
}

function emptySa(actionName) {
  return { smartActionName: actionName };
}

function applyTwoPartHeader(collectionMap, colName, suffix, rawValue) {
  if (!CRUD_SUFFIXES.includes(suffix)) {
    throw new Error(`Unknown permission column "${colName}:${suffix}" in CSV.`);
  }
  const col = collectionMap[colName] || emptyCollection(colName);
  return { ...collectionMap, [colName]: { ...col, [CRUD_FIELD_MAP[suffix]]: parseBool(rawValue) } };
}

function applyThreePartHeader(collectionMap, colName, actionName, suffix, rawValue) {
  // hasConditions is derived/read-only on export — ignore it on the write path.
  if (suffix === 'hasConditions') return collectionMap;
  if (!SMART_ACTION_WRITE_SUFFIXES.includes(suffix)) {
    throw new Error(`Unknown smart-action column "${colName}:${actionName}:${suffix}" in CSV.`);
  }
  const col = collectionMap[colName] || emptyCollection(colName);
  const existingSa =
    col.smartActions.find(a => a.smartActionName === actionName) || emptySa(actionName);
  const updatedSa = { ...existingSa, [SA_FIELD_MAP[suffix]]: parseBool(rawValue) };
  const updatedSmartActions = col.smartActions.find(a => a.smartActionName === actionName)
    ? col.smartActions.map(a => (a.smartActionName === actionName ? updatedSa : a))
    : [...col.smartActions, updatedSa];
  return { ...collectionMap, [colName]: { ...col, smartActions: updatedSmartActions } };
}

function splitSuffix(header) {
  const lastColon = header.lastIndexOf(':');
  if (lastColon === -1) return null;
  return { prefix: header.slice(0, lastColon), suffix: header.slice(lastColon + 1) };
}

// A CRUD column carries its collection name whole, colons included, and the export
// writes one for every collection: they pin where a smart-action column's collection ends.
function collectionNamesFromCrudHeaders(headers) {
  const names = headers
    .map(splitSuffix)
    .filter(split => split && split.prefix && CRUD_SUFFIXES.includes(split.suffix))
    .map(split => split.prefix);
  return [...new Set(names)];
}

function smartActionCollectionName(header, prefix, knownCollections) {
  const owners = [...knownCollections.keys()].filter(
    name => prefix.startsWith(`${name}:`) && prefix.length > name.length + 1,
  );
  // Two collections can own the column's prefix, as `billing` and `billing:invoices`
  // do for `billing:invoices:Refund:trigger`: the one that has the action settles it.
  const ownersWithTheAction = owners.filter(name =>
    knownCollections.get(name).has(prefix.slice(name.length + 1)),
  );
  if (owners.length > 1 && ownersWithTheAction.length === 1) return ownersWithTheAction[0];
  if (owners.length > 1) {
    const candidates = owners.map(name => `"${name}"`).join(' or ');
    throw new Error(`Ambiguous CSV column "${header}": its collection could be ${candidates}.`);
  }
  if (owners.length === 1) return owners[0];

  // A collection neither the environment nor a CRUD column knows. With one colon the
  // split is certain; with more, either name could hold one, so guessing could patch
  // the wrong collection.
  const firstColon = prefix.indexOf(':');
  if (firstColon === -1) return null;
  if (prefix.indexOf(':', firstColon + 1) !== -1) {
    throw new Error(
      `Ambiguous CSV column "${header}": no known collection matches it, and its name has more than one colon. Add a CRUD column for its collection.`,
    );
  }
  return prefix.slice(0, firstColon);
}

/**
 * Split a column header into its parts, keying off the trailing suffix instead of
 * splitting on every colon: smart-action names routinely contain one (e.g.
 * "Organisation:SAML SSO #2: Edit SSO config:trigger"). The CRUD and smart-action
 * suffix sets are disjoint, so the trailing segment tells the two column shapes apart.
 * @returns {{ collectionName: string, actionName?: string, suffix: string }|null}
 */
function parseHeader(header, knownCollections) {
  const split = splitSuffix(header);
  if (!split || !split.prefix) return null;
  const { prefix, suffix } = split;

  if (SMART_ACTION_SUFFIXES.includes(suffix)) {
    const collectionName = smartActionCollectionName(header, prefix, knownCollections);
    if (collectionName === null) return null;
    return { collectionName, actionName: prefix.slice(collectionName.length + 1), suffix };
  }
  // Unknown suffixes land here too, and applyTwoPartHeader rejects them with the
  // more precise "Unknown permission column" message.
  return { collectionName: prefix, suffix };
}

function applyHeader(collectionMap, header, rawValue, knownCollections) {
  const parsed = parseHeader(header, knownCollections);
  if (!parsed) throw new Error(`Unrecognized CSV column "${header}".`);
  if (parsed.actionName === undefined) {
    return applyTwoPartHeader(collectionMap, parsed.collectionName, parsed.suffix, rawValue);
  }
  return applyThreePartHeader(
    collectionMap,
    parsed.collectionName,
    parsed.actionName,
    parsed.suffix,
    rawValue,
  );
}

function parseRow(headers, cells, envId, knownCollections) {
  if (cells.length !== headers.length) {
    throw new Error(`CSV row has ${cells.length} cell(s) but the header has ${headers.length}.`);
  }
  const row = headers.reduce((acc, h, j) => ({ ...acc, [h]: cells[j] }), {});
  const name = row.role;
  const enabled = parseBool(row.enabled);

  const collectionMap = Object.keys(row)
    .filter(h => h !== 'role' && h !== 'enabled')
    .reduce((map, h) => applyHeader(map, h, row[h], knownCollections), {});

  return { name, enabled, envId: String(envId), collections: Object.values(collectionMap) };
}

/**
 * Parse a wide CSV string back into a structured desired-state array.
 * @param {string} csvContent
 * @param {string|number} envId
 * @param {Map<string, Set<string>>} [environmentCollections] the environment's
 *   collections and their smart actions, from environmentCollectionsOf, so a
 *   smart-action column finds its collection even when no CRUD column in the file
 *   names it. A permission whose column the file omits is left off its collection or
 *   action, and computeDiff leaves it unchanged.
 */
function parseWide(csvContent, envId, environmentCollections = new Map()) {
  // Split on CRLF or LF: a CSV saved by Excel/Windows uses \r\n, and a trailing
  // \r would otherwise taint the last field (e.g. `enabled\r`) and break parsing.
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const knownCollections = new Map(environmentCollections);
  collectionNamesFromCrudHeaders(headers)
    .filter(name => !knownCollections.has(name))
    .forEach(name => knownCollections.set(name, new Set()));
  return lines.slice(1).map(line => parseRow(headers, parseCsvLine(line), envId, knownCollections));
}

// ---------------------------------------------------------------------------
// computeDiff helpers
// ---------------------------------------------------------------------------

function diffEnabled(cur, desired, envId) {
  const curEnabled = cur ? cur.enabled : false;
  if (curEnabled === desired.enabled) return [];
  return [{ op: 'replace', path: `/environments/${envId}/enabled`, value: desired.enabled }];
}

// The server decodes each name segment and rejects a raw space, colon or slash in one.
function permissionPath(envId, ...segments) {
  return `/environments/${envId}/${segments.map(encodeURIComponent).join('/')}`;
}

function diffCrudField(envId, colName, curCol, field, desiredVal) {
  const curVal = curCol ? Boolean(curCol[field]) : false;
  if (curVal === desiredVal) return null;
  return {
    op: 'replace',
    path: permissionPath(envId, 'collections', colName, field),
    value: desiredVal,
  };
}

function diffCrud(envId, desiredCol, curCol) {
  return CRUD_FIELDS.filter(field => desiredCol[field] !== undefined)
    .map(field =>
      diffCrudField(envId, desiredCol.collectionName, curCol, field, Boolean(desiredCol[field])),
    )
    .filter(Boolean);
}

function diffSaField(envId, colName, actionName, curSa, field, desiredVal) {
  const curVal = curSa ? Boolean(curSa[field]) : false;
  if (curVal === desiredVal) return null;
  return {
    op: 'replace',
    path: permissionPath(envId, 'collections', colName, 'smartActions', actionName, field),
    value: desiredVal,
  };
}

function diffSmartAction(envId, colName, desiredSa, curCol) {
  const curSa = curCol
    ? (curCol.smartActions || []).find(a => a.smartActionName === desiredSa.smartActionName)
    : null;
  return SA_FIELDS.filter(field => desiredSa[field] !== undefined)
    .map(field =>
      diffSaField(
        envId,
        colName,
        desiredSa.smartActionName,
        curSa,
        field,
        Boolean(desiredSa[field]),
      ),
    )
    .filter(Boolean);
}

function diffCollection(envId, desiredCol, cur) {
  const curCol = cur
    ? (cur.collections || []).find(c => c.collectionName === desiredCol.collectionName)
    : null;
  const crudOps = diffCrud(envId, desiredCol, curCol);
  const saOps = (desiredCol.smartActions || []).reduce(
    (acc, desiredSa) => [
      ...acc,
      ...diffSmartAction(envId, desiredCol.collectionName, desiredSa, curCol),
    ],
    [],
  );
  return [...crudOps, ...saOps];
}

function diffRole(current, desired) {
  const cur = current.find(r => r.name === desired.name);
  const { envId } = desired;
  const enabledOps = diffEnabled(cur, desired, envId);
  const collectionOps = desired.collections.reduce(
    (acc, desiredCol) => [...acc, ...diffCollection(envId, desiredCol, cur)],
    [],
  );
  return {
    roleName: desired.name,
    roleId: cur ? cur.id : null,
    ops: [...enabledOps, ...collectionOps],
  };
}

/**
 * Compute the diff between the current state and the desired state.
 * @param {Array} current
 * @param {Array} parsed
 */
function computeDiff(current, parsed) {
  return parsed.map(desired => diffRole(current, desired));
}

module.exports = { currentStateOf, environmentCollectionsOf, formatWide, parseWide, computeDiff };
