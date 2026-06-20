/**
 * Wide role-centric CSV formatting for `forest roles:export`.
 * PRD-535. The parse / diff side (consumed by `forest roles:apply`) lands in PRD-528.
 */

const CRUD_SUFFIXES = ['browse', 'read', 'add', 'edit', 'delete', 'export'];
const SMART_ACTION_SUFFIXES = [
  'trigger',
  'approvalRequired',
  'userApproval',
  'selfApproval',
  'hasConditions',
];

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

// ---------------------------------------------------------------------------
// Build the ordered column list from a set of roles (for formatWide)
// ---------------------------------------------------------------------------

function collectSmartActionsForCollection(roles, envId, colName) {
  const actionSet = new Set();
  roles.forEach(role => {
    const envPerms = (role.permissions.environments || []).find(
      e => String(e.id) === String(envId),
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
      e => String(e.id) === String(envId),
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
  if (suffix === 'hasConditions') return sa.conditionCreator != null || sa.conditionCaller != null;
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
  const envPerms = (role.permissions.environments || []).find(e => String(e.id) === String(envId));
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

module.exports = { formatWide };
