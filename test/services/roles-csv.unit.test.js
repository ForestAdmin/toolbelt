const { formatWide, parseWide, computeDiff } = require('../../src/services/roles-csv');

// Real backend shape: environments[].environmentId, collections[].<crud>Enabled,
// smartActions[].{triggerEnabled, approvalRequired, userApprovalEnabled,
// selfApprovalEnabled, triggerCondition?, approvalRequiredCondition?, userApprovalCondition?}.
const role = (name, environments) => ({ id: '1', name, permissions: { environments } });

const rows = csv => csv.trim().split('\n');

describe('roles-csv formatWide', () => {
  it('maps CRUD flags to true/false cells and the env-level enabled column', () => {
    expect.assertions(2);
    const csv = formatWide(
      [
        role('Admin', [
          {
            environmentId: 3,
            enabled: true,
            collections: [
              {
                collectionName: 'orders',
                browseEnabled: true,
                readEnabled: true,
                addEnabled: false,
                editEnabled: false,
                deleteEnabled: false,
                exportEnabled: true,
                smartActions: [],
              },
            ],
          },
        ]),
      ],
      3,
    );
    const [header, row] = rows(csv);
    expect(header).toBe(
      'role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export',
    );
    expect(row).toBe('Admin,true,true,true,false,false,false,true');
  });

  it('maps smart-action flags and derives hasConditions from the *Condition fields', () => {
    expect.assertions(2);
    const collections = [
      {
        collectionName: 'orders',
        browseEnabled: false,
        readEnabled: false,
        addEnabled: false,
        editEnabled: false,
        deleteEnabled: false,
        exportEnabled: false,
        smartActions: [
          {
            smartActionName: 'ship',
            triggerEnabled: true,
            approvalRequired: false,
            userApprovalEnabled: true,
            selfApprovalEnabled: false,
            triggerCondition: { field: 'status' },
          },
        ],
      },
    ];
    const csv = formatWide([role('R', [{ environmentId: 3, enabled: true, collections }])], 3);
    const [header, row] = rows(csv);
    // ...:trigger, :approvalRequired, :userApproval, :selfApproval, :hasConditions
    expect(
      header.endsWith(
        'orders:ship:trigger,orders:ship:approvalRequired,orders:ship:userApproval,orders:ship:selfApproval,orders:ship:hasConditions',
      ),
    ).toBe(true);
    expect(row.endsWith('true,false,true,false,true')).toBe(true);
  });

  it('hasConditions is false when no *Condition field is set', () => {
    expect.assertions(1);
    const collections = [
      {
        collectionName: 'orders',
        smartActions: [
          {
            smartActionName: 'ship',
            triggerEnabled: true,
            approvalRequired: false,
            userApprovalEnabled: false,
            selfApprovalEnabled: false,
          },
        ],
      },
    ];
    const csv = formatWide([role('R', [{ environmentId: 3, enabled: true, collections }])], 3);
    // last column is orders:ship:hasConditions → false (no *Condition field set)
    expect(rows(csv)[1].endsWith('false')).toBe(true);
  });

  it('emits enabled=false and all-false cells when the role has no perms for the env', () => {
    expect.assertions(1);
    const csv = formatWide(
      [
        role('Other', [
          {
            environmentId: 99, // different env
            enabled: true,
            collections: [{ collectionName: 'orders', browseEnabled: true, smartActions: [] }],
          },
        ]),
      ],
      3,
    );
    // env 3 not present → no columns from this role, enabled=false
    expect(rows(csv)[1]).toBe('Other,false');
  });

  it('unions columns across roles and fills false for collections a role lacks', () => {
    expect.assertions(3);
    const csv = formatWide(
      [
        role('A', [
          {
            environmentId: 3,
            enabled: true,
            collections: [{ collectionName: 'orders', browseEnabled: true, smartActions: [] }],
          },
        ]),
        role('B', [
          {
            environmentId: 3,
            enabled: true,
            collections: [{ collectionName: 'users', browseEnabled: true, smartActions: [] }],
          },
        ]),
      ],
      3,
    );
    const [header, rowA, rowB] = rows(csv);
    // sorted union: orders then users
    expect(header).toBe(
      'role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export,users:browse,users:read,users:add,users:edit,users:delete,users:export',
    );
    expect(rowA).toBe(
      'A,true,true,false,false,false,false,false,false,false,false,false,false,false',
    );
    expect(rowB).toBe(
      'B,true,false,false,false,false,false,false,true,false,false,false,false,false',
    );
  });

  it('quotes values containing a comma or quote (RFC 4180)', () => {
    expect.assertions(1);
    const csv = formatWide(
      [
        role('Ops, "Lead"', [
          {
            environmentId: 3,
            enabled: true,
            collections: [{ collectionName: 'orders', smartActions: [] }],
          },
        ]),
      ],
      3,
    );
    expect(rows(csv)[1].startsWith('"Ops, ""Lead"""')).toBe(true);
  });
});

describe('roles-csv parseWide', () => {
  it('should preserve a value containing escaped double quotes', () => {
    expect.assertions(2);
    // `Ops "EU"` is encoded as a quoted field with doubled inner quotes.
    const csv = ['role,enabled,orders:browse', '"Ops ""EU""",true,true'].join('\n');

    const [parsed] = parseWide(csv, '3');

    expect(parsed.name).toBe('Ops "EU"');
    expect(parsed.enabled).toBe(true);
  });

  it('should round-trip a quoted role name through formatWide then parseWide', () => {
    expect.assertions(1);
    const roles = [
      {
        id: '7',
        name: 'Ops "EU", APAC',
        permissions: {
          environments: [
            {
              environmentId: 3,
              enabled: true,
              collections: [{ collectionName: 'orders', browseEnabled: true }],
            },
          ],
        },
      },
    ];

    const [parsed] = parseWide(formatWide(roles, 3), '3');

    expect(parsed.name).toBe('Ops "EU", APAC');
  });

  it('handles CRLF line endings (Excel/Windows CSV)', () => {
    expect.assertions(2);
    const csv = ['role,enabled,orders:browse', 'Ops,true,true'].join('\r\n');

    const [parsed] = parseWide(csv, '3');

    expect(parsed.enabled).toBe(true);
    expect(parsed.collections[0].browseEnabled).toBe(true);
  });

  it('rejects an invalid boolean cell (write-safety: no silent coercion)', () => {
    expect.assertions(1);
    const csv = ['role,enabled,orders:browse', 'Ops,true,TRUE-ish'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('Invalid boolean');
  });

  it('rejects an unknown permission column (catches typos before a write)', () => {
    expect.assertions(1);
    const csv = ['role,enabled,orders:edt', 'Ops,true,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('Unknown permission column "orders:edt"');
  });

  it('rejects a row whose cell count does not match the header', () => {
    expect.assertions(1);
    const csv = ['role,enabled,orders:browse', 'Ops,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('CSV row has 2 cell(s)');
  });
});

describe('roles-csv computeDiff', () => {
  const desiredRole = (name, browseEnabled) => ({
    name,
    enabled: true,
    envId: '3',
    collections: [{ collectionName: 'orders', browseEnabled, smartActions: [] }],
  });

  it('emits a single replace op for a CRUD flip', () => {
    expect.assertions(1);
    const current = [{ name: 'Admin', id: '3', enabled: true, collections: [] }];
    const desired = [desiredRole('Admin', true)];

    const [diff] = computeDiff(current, desired);

    expect(diff.ops).toContainEqual({
      op: 'replace',
      path: '/environments/3/collections/orders/browseEnabled',
      value: true,
    });
  });

  it('emits no op when current equals desired', () => {
    expect.assertions(1);
    const current = [
      {
        name: 'Admin',
        id: '3',
        enabled: true,
        collections: [{ collectionName: 'orders', browseEnabled: true }],
      },
    ];

    expect(computeDiff(current, [desiredRole('Admin', true)])[0].ops).toStrictEqual([]);
  });

  it('flags a role absent from current with roleId null (apply rejects it)', () => {
    expect.assertions(1);
    expect(computeDiff([], [desiredRole('Ghost', true)])[0].roleId).toBeNull();
  });

  it('emits a smart-action flag op on the correct path', () => {
    expect.assertions(1);
    const desired = [
      {
        name: 'Admin',
        enabled: true,
        envId: '3',
        collections: [
          {
            collectionName: 'orders',
            smartActions: [{ smartActionName: 'ship', triggerEnabled: true }],
          },
        ],
      },
    ];

    const [diff] = computeDiff(
      [{ name: 'Admin', id: '3', enabled: true, collections: [] }],
      desired,
    );

    expect(diff.ops).toContainEqual({
      op: 'replace',
      path: '/environments/3/collections/orders/smartActions/ship/triggerEnabled',
      value: true,
    });
  });
});
