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
        if (ch === '"') {
          if (line[i + 1] === '"') {
            return { ...acc, current: `${acc.current}"`, skipNext: true };
          }
          return { ...acc, inQuotes: false };
        }
        if (acc.skipNext) return { ...acc, skipNext: false };
        return { ...acc, current: acc.current + ch };
      }
      if (acc.skipNext) return { ...acc, skipNext: false };
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

function parseBool(str) {
  return str === 'true';
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
    const crudCols = CRUD_SUFFIXES.map(s => `${colName}:${s}`);
    const actions = collectSmartActionsForCollection(roles, envId, colName);
    const saCols = actions.reduce(
      (acc, action) => [...acc, ...SMART_ACTION_SUFFIXES.map(s => `${colName}:${action}:${s}`)],
      [],
    );
    return [...cols, ...crudCols, ...saCols];
  }, []);
}

function buildColumns(roles, envId) {
  const collectionSet = new Set();
  roles.forEach(role => {
    const envPerms = (role.permissions.environments || []).find(
      e => String(e.environmentId ?? e.id) === String(envId),
    );
    if (!envPerms) return;
    (envPerms.collections || []).forEach(col => collectionSet.add(col.collectionName));
  });
  const collections = Array.from(collectionSet).sort();
  return collectColumns(collections, roles, envId);
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

function buildCellForColumn(colHeader, colByName) {
  const parts = colHeader.split(':');
  if (parts.length === 2) {
    const [colName, suffix] = parts;
    return String(getCrudValue(colByName[colName], suffix));
  }
  if (parts.length === 3) {
    const [colName, actionName, suffix] = parts;
    return String(getSmartActionValue(colByName[colName], actionName, suffix));
  }
  return 'false';
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
  const header = ['role', 'enabled', ...columns].map(escapeCsv).join(',');
  const rows = [header, ...roles.map(role => buildRoleRow(role, columns, envId))];
  return `${rows.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// parseWide helpers
// ---------------------------------------------------------------------------

function emptyCollection(colName) {
  return {
    collectionName: colName,
    browseEnabled: false,
    readEnabled: false,
    addEnabled: false,
    editEnabled: false,
    deleteEnabled: false,
    exportEnabled: false,
    smartActions: [],
  };
}

function emptySa(actionName) {
  return {
    smartActionName: actionName,
    triggerEnabled: false,
    approvalRequired: false,
    userApprovalEnabled: false,
    selfApprovalEnabled: false,
  };
}

function applyTwoPartHeader(collectionMap, colName, suffix, rawValue) {
  if (!CRUD_SUFFIXES.includes(suffix)) return collectionMap;
  const col = collectionMap[colName] || emptyCollection(colName);
  return { ...collectionMap, [colName]: { ...col, [CRUD_FIELD_MAP[suffix]]: parseBool(rawValue) } };
}

function applyThreePartHeader(collectionMap, colName, actionName, suffix, rawValue) {
  if (suffix === 'hasConditions' || !SMART_ACTION_WRITE_SUFFIXES.includes(suffix)) {
    return collectionMap;
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

function applyHeader(collectionMap, header, rawValue) {
  const parts = header.split(':');
  if (parts.length === 2) return applyTwoPartHeader(collectionMap, parts[0], parts[1], rawValue);
  if (parts.length === 3)
    return applyThreePartHeader(collectionMap, parts[0], parts[1], parts[2], rawValue);
  return collectionMap;
}

function parseRow(headers, cells, envId) {
  const row = headers.reduce((acc, h, j) => ({ ...acc, [h]: cells[j] || '' }), {});
  const name = row.role;
  const enabled = parseBool(row.enabled);

  const collectionMap = Object.keys(row)
    .filter(h => h !== 'role' && h !== 'enabled')
    .reduce((map, h) => applyHeader(map, h, row[h]), {});

  return { name, enabled, envId: String(envId), collections: Object.values(collectionMap) };
}

/**
 * Parse a wide CSV string back into a structured desired-state array.
 * @param {string} csvContent
 * @param {string|number} envId
 */
function parseWide(csvContent, envId) {
  const lines = csvContent.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => parseRow(headers, parseCsvLine(line), envId));
}

// ---------------------------------------------------------------------------
// computeDiff helpers
// ---------------------------------------------------------------------------

function diffEnabled(cur, desired, envId) {
  const curEnabled = cur ? cur.enabled : false;
  if (curEnabled === desired.enabled) return [];
  return [{ op: 'replace', path: `/environments/${envId}/enabled`, value: desired.enabled }];
}

function diffCrudField(envId, colName, curCol, field, desiredVal) {
  const curVal = curCol ? Boolean(curCol[field]) : false;
  if (curVal === desiredVal) return null;
  return {
    op: 'replace',
    path: `/environments/${envId}/collections/${colName}/${field}`,
    value: desiredVal,
  };
}

function diffCrud(envId, desiredCol, curCol) {
  const fields = [
    'browseEnabled',
    'readEnabled',
    'addEnabled',
    'editEnabled',
    'deleteEnabled',
    'exportEnabled',
  ];
  return fields
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
    path: `/environments/${envId}/collections/${colName}/smartActions/${actionName}/${field}`,
    value: desiredVal,
  };
}

function diffSmartAction(envId, colName, desiredSa, curCol) {
  const curSa = curCol
    ? (curCol.smartActions || []).find(a => a.smartActionName === desiredSa.smartActionName)
    : null;
  const saFields = [
    'triggerEnabled',
    'approvalRequired',
    'userApprovalEnabled',
    'selfApprovalEnabled',
  ];
  return saFields
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

module.exports = { formatWide, parseWide, computeDiff };
