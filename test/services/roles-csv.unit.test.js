const { formatWide } = require('../../src/services/roles-csv');

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
