const {
  currentStateOf,
  environmentCollectionsOf,
  formatWide,
  parseWide,
  computeDiff,
} = require('../../src/services/roles-csv');

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

  it('emits real cell values for a smart action whose name contains a colon', () => {
    expect.assertions(2);
    const collections = [
      {
        collectionName: 'Organisation',
        smartActions: [
          {
            smartActionName: 'SAML SSO #2: Edit SSO config',
            triggerEnabled: true,
            approvalRequired: true,
            userApprovalEnabled: false,
            selfApprovalEnabled: false,
          },
        ],
      },
    ];
    const csv = formatWide([role('R', [{ environmentId: 3, enabled: true, collections }])], 3);
    const [header, row] = rows(csv);

    expect(header).toContain('Organisation:SAML SSO #2: Edit SSO config:trigger');
    // Regression: the colon in the action name used to make every cell read "false".
    expect(row.endsWith('true,true,false,false,false')).toBe(true);
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

  it('parses a smart-action column whose action name contains a colon (PRD-535 regression)', () => {
    expect.assertions(2);
    // Verbatim shape of the column `roles:export` produced for a customer, which
    // `roles:apply` then rejected as an unrecognized column.
    const csv = [
      'role,enabled,Organisation:browse,Organisation:SAML SSO #2: Edit SSO config:trigger',
      'Ops,true,true,true',
    ].join('\n');
    const [parsed] = parseWide(csv, '3');
    const [collection] = parsed.collections;

    expect(collection.browseEnabled).toBe(true);
    expect(collection.smartActions).toStrictEqual([
      { smartActionName: 'SAML SSO #2: Edit SSO config', triggerEnabled: true },
    ]);
  });

  it('keeps a colon in the collection name on a CRUD column', () => {
    expect.assertions(1);
    const csv = ['role,enabled,schema:orders:browse', 'Ops,true,true'].join('\n');

    expect(parseWide(csv, '3')[0].collections[0].collectionName).toBe('schema:orders');
  });

  it('round-trips smart actions through formatWide then parseWide when names contain colons', () => {
    expect.assertions(2);
    const smartAction = smartActionName => ({
      smartActionName,
      triggerEnabled: true,
      approvalRequired: false,
      userApprovalEnabled: false,
      selfApprovalEnabled: false,
    });
    const collections = [
      {
        collectionName: 'Organisation',
        browseEnabled: true,
        smartActions: [smartAction('SAML SSO #2: Edit SSO config')],
      },
      { collectionName: 'schema:orders', browseEnabled: true, smartActions: [smartAction('Act')] },
    ];
    const roles = [role('Ops', [{ environmentId: 3, enabled: true, collections }])];

    const [parsed] = parseWide(formatWide(roles, 3), '3');
    const byName = Object.fromEntries(parsed.collections.map(c => [c.collectionName, c]));

    expect(Object.keys(byName).sort()).toStrictEqual(['Organisation', 'schema:orders']);
    expect(byName['schema:orders'].smartActions).toStrictEqual([smartAction('Act')]);
  });

  it("resolves a smart-action column's collection from the environment when its CRUD columns are absent", () => {
    expect.assertions(2);
    const csv = ['role,enabled,schema:orders:Act:trigger', 'Ops,true,true'].join('\n');

    const environment = new Map([
      ['orders', new Set()],
      ['schema:orders', new Set(['Act'])],
    ]);

    const [collection] = parseWide(csv, '3', environment)[0].collections;

    expect(collection.collectionName).toBe('schema:orders');
    expect(collection.smartActions.map(a => a.smartActionName)).toStrictEqual(['Act']);
  });

  it('settles a column two collections could own by the one whose action it names', () => {
    expect.assertions(2);
    const csv = ['role,enabled,billing:invoices:Refund:trigger', 'Ops,true,true'].join('\n');
    const environment = new Map([
      ['billing', new Set()],
      ['billing:invoices', new Set(['Refund'])],
    ]);

    const [collection] = parseWide(csv, '3', environment)[0].collections;

    expect(collection.collectionName).toBe('billing:invoices');
    expect(collection.smartActions.map(a => a.smartActionName)).toStrictEqual(['Refund']);
  });

  it('rejects a column that names an action of both collections that could own it', () => {
    expect.assertions(1);
    const csv = ['role,enabled,billing:invoices:Refund:trigger', 'Ops,true,true'].join('\n');
    const environment = new Map([
      ['billing', new Set(['invoices:Refund'])],
      ['billing:invoices', new Set(['Refund'])],
    ]);

    expect(() => parseWide(csv, '3', environment)).toThrow(
      'Ambiguous CSV column "billing:invoices:Refund:trigger": its collection could be "billing" or "billing:invoices".',
    );
  });

  it('takes the first segment as the collection when nothing knows it and the split is certain', () => {
    expect.assertions(2);
    const csv = ['role,enabled,orders:ship:trigger', 'Ops,true,true'].join('\n');

    const [collection] = parseWide(csv, '3')[0].collections;

    expect(collection.collectionName).toBe('orders');
    expect(collection.smartActions.map(a => a.smartActionName)).toStrictEqual(['ship']);
  });

  it('rejects a smart-action column with several colons whose collection nothing knows', () => {
    expect.assertions(1);
    const csv = ['role,enabled,schema:orders:Act:trigger', 'Ops,true,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow(
      'Ambiguous CSV column "schema:orders:Act:trigger": no known collection matches it',
    );
  });

  it('rejects a smart-action column whose collection two known collections could own', () => {
    expect.assertions(1);
    const csv = [
      'role,enabled,schema:browse,schema:orders:browse,schema:orders:Act:trigger',
      'Ops,true,true,true,true',
    ].join('\n');

    expect(() => parseWide(csv, '3')).toThrow(
      'Ambiguous CSV column "schema:orders:Act:trigger": its collection could be "schema" or "schema:orders".',
    );
  });

  it('rejects a smart-action column with no action name', () => {
    expect.assertions(1);
    const csv = ['role,enabled,orders:trigger', 'Ops,true,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('Unrecognized CSV column "orders:trigger"');
  });

  it('rejects a column with no collection name', () => {
    expect.assertions(1);
    const csv = ['role,enabled,:browse', 'Ops,true,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('Unrecognized CSV column ":browse"');
  });

  it('rejects a column with no colon at all', () => {
    expect.assertions(1);
    const csv = ['role,enabled,orders', 'Ops,true,true'].join('\n');

    expect(() => parseWide(csv, '3')).toThrow('Unrecognized CSV column "orders"');
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

  it('encodes collection and action names as URI components in op paths', () => {
    expect.assertions(1);
    const desired = [
      {
        name: 'Admin',
        enabled: true,
        envId: '3',
        collections: [
          {
            collectionName: 'schema:orders',
            browseEnabled: true,
            smartActions: [{ smartActionName: 'Refund / cancel: now', triggerEnabled: true }],
          },
        ],
      },
    ];

    const [diff] = computeDiff(
      [{ name: 'Admin', id: '3', enabled: true, collections: [] }],
      desired,
    );

    expect(diff.ops.map(op => op.path)).toStrictEqual([
      '/environments/3/collections/schema%3Aorders/browseEnabled',
      '/environments/3/collections/schema%3Aorders/smartActions/Refund%20%2F%20cancel%3A%20now/triggerEnabled',
    ]);
  });

  it('leaves alone every permission whose column the CSV omits', () => {
    expect.assertions(1);
    const current = [
      {
        name: 'Admin',
        id: '3',
        enabled: true,
        collections: [
          {
            collectionName: 'orders',
            browseEnabled: true,
            readEnabled: true,
            smartActions: [
              { smartActionName: 'ship', triggerEnabled: true, approvalRequired: true },
            ],
          },
        ],
      },
    ];
    const csv = ['role,enabled,orders:read,orders:ship:trigger', 'Admin,true,false,false'].join(
      '\n',
    );

    const [diff] = computeDiff(current, parseWide(csv, '3'));

    expect(diff.ops).toStrictEqual([
      { op: 'replace', path: '/environments/3/collections/orders/readEnabled', value: false },
      {
        op: 'replace',
        path: '/environments/3/collections/orders/smartActions/ship/triggerEnabled',
        value: false,
      },
    ]);
  });
});

describe('roles-csv displayName columns', () => {
  const ENV = 3;
  const sa = (name, extra = {}) => ({
    smartActionName: name,
    triggerEnabled: true,
    approvalRequired: false,
    userApprovalEnabled: false,
    selfApprovalEnabled: false,
    ...extra,
  });
  const collection = (name, smartActions = [], flag = true) => ({
    collectionName: name,
    browseEnabled: flag,
    readEnabled: flag,
    addEnabled: flag,
    editEnabled: flag,
    deleteEnabled: flag,
    exportEnabled: flag,
    smartActions,
  });
  const admin = collections => role('Admin', [{ environmentId: ENV, enabled: true, collections }]);
  const labelsOf = collections => ({ collections });

  // The same inputs apply.ts builds: the roles' own state (with ids), and the file parsed
  // with the environment's collections.
  const diffOf = (roles, csv) => {
    const current = currentStateOf(roles, ENV).map((state, i) => ({ ...state, id: `id-${i}` }));
    const desired = parseWide(csv, ENV, environmentCollectionsOf(roles, ENV));
    return computeDiff(current, desired);
  };
  const expectNoOp = diffs => {
    expect(diffs.map(d => d.roleId)).not.toContain(null);
    expect(diffs.flatMap(d => d.ops)).toStrictEqual([]);
  };

  const roles = [admin([collection('orders', [sa('Mark as shipped')])])];
  const labels = labelsOf([
    {
      name: 'orders',
      displayName: 'Commandes',
      actions: [{ name: 'Mark as shipped', displayName: 'Marquer expédiée' }],
    },
  ]);

  it('leaves the CSV untouched when no labels are given', () => {
    expect.assertions(2);
    expect(formatWide(roles, ENV, undefined)).toBe(formatWide(roles, ENV));
    expect(rows(formatWide(roles, ENV))[0]).not.toContain('displayName');
  });

  it('puts each display name first in its collection and smart action group', () => {
    expect.assertions(2);
    const [header, row] = rows(formatWide(roles, ENV, labels));
    expect(header.split(',').filter(h => h.endsWith(':displayName'))).toStrictEqual([
      'orders:displayName',
      'orders:Mark as shipped:displayName',
    ]);
    expect(row.split(',').slice(0, 3)).toStrictEqual(['Admin', 'true', 'Commandes']);
  });

  it('fills a smart action column with its display name on every role row', () => {
    expect.assertions(1);
    const two = [
      ...roles,
      role('Viewer', [{ environmentId: ENV, enabled: false, collections: [] }]),
    ];
    const [header, ...body] = rows(formatWide(two, ENV, labels));
    const index = header.split(',').indexOf('orders:Mark as shipped:displayName');
    expect(body.map(r => r.split(',')[index])).toStrictEqual([
      'Marquer expédiée',
      'Marquer expédiée',
    ]);
  });

  it('falls back to the technical name for a collection or action the labels lack', () => {
    expect.assertions(2);
    const partial = labelsOf([{ name: 'orders', displayName: 'Commandes', actions: [] }]);
    const [header, row] = rows(formatWide(roles, ENV, partial));
    const cells = row.split(',');
    expect(cells[header.split(',').indexOf('orders:displayName')]).toBe('Commandes');
    expect(cells[header.split(',').indexOf('orders:Mark as shipped:displayName')]).toBe(
      'Mark as shipped',
    );
  });

  it('falls back to technical names for an empty label list', () => {
    expect.assertions(1);
    const [header, row] = rows(formatWide(roles, ENV, labelsOf([])));
    expect(row.split(',')[header.split(',').indexOf('orders:displayName')]).toBe('orders');
  });

  it('replaces line breaks in a label with a space and still plans no operation', () => {
    expect.assertions(3);
    const multiLine = labelsOf([
      { name: 'orders', displayName: 'Ship\nnow\r\nplease\r', actions: [] },
    ]);
    const csv = formatWide(roles, ENV, multiLine);
    expect(rows(csv)[1].split(',')[2]).toBe('Ship now please ');
    expectNoOp(diffOf(roles, csv));
  });

  it('plans no operation on a --team export read back unchanged', () => {
    expect.assertions(2);
    expectNoOp(diffOf(roles, formatWide(roles, ENV, labels)));
  });

  it('ignores an edited displayName cell', () => {
    expect.assertions(2);
    const csv = formatWide(roles, ENV, labels)
      .replace('Commandes', 'Renamed')
      .replace('Marquer expédiée', 'true');
    expectNoOp(diffOf(roles, csv));
  });

  it('still rejects a wrong-case displayName column', () => {
    expect.assertions(2);
    const header = 'role,enabled,orders:displayname';
    expect(() => parseWide(`${header}\nAdmin,true,x\n`, ENV)).toThrow(
      'Unknown permission column "orders:displayname"',
    );
    expect(() => parseWide('role,enabled,orders:Ship:displayname\nAdmin,true,x\n', ENV)).toThrow(
      'Unknown permission column "orders:Ship:displayname"',
    );
  });

  it('still parses an action literally named displayName as a write column', () => {
    expect.assertions(1);
    const parsed = parseWide('role,enabled,orders:displayName:trigger\nAdmin,true,true\n', ENV);
    expect(parsed[0].collections).toStrictEqual([
      {
        collectionName: 'orders',
        smartActions: [{ smartActionName: 'displayName', triggerEnabled: true }],
      },
    ]);
  });

  describe('with colon names', () => {
    const colonRoles = [
      admin([
        collection('billing', [sa('SAML SSO #2: Edit SSO config')]),
        collection('billing:invoices', [sa('Refund')]),
      ]),
    ];
    const colonLabels = labelsOf([
      {
        name: 'billing',
        displayName: 'Facturation',
        actions: [{ name: 'SAML SSO #2: Edit SSO config', displayName: 'SSO' }],
      },
      {
        name: 'billing:invoices',
        displayName: 'Factures',
        actions: [{ name: 'Refund', displayName: 'Rembourser' }],
      },
    ]);

    it('carries the right label on each column and plans no operation', () => {
      expect.assertions(4);
      const csv = formatWide(colonRoles, ENV, colonLabels);
      const [header, row] = rows(csv);
      const cell = h => row.split(',')[header.split(',').indexOf(h)];
      expect(cell('billing:invoices:Refund:displayName')).toBe('Rembourser');
      expect(cell('billing:SAML SSO #2: Edit SSO config:displayName')).toBe('SSO');
      expectNoOp(diffOf(colonRoles, csv));
    });

    it('rejects colliding write headers as ambiguous, not as a displayName error', () => {
      expect.assertions(1);
      const colliding = [
        admin([
          collection('billing', [sa('invoices:Refund', { triggerEnabled: true })]),
          collection('billing:invoices', [sa('Refund', { triggerEnabled: false })]),
        ]),
      ];
      expect(() => diffOf(colliding, formatWide(colliding, ENV, labelsOf([])))).toThrow(
        'Ambiguous CSV column',
      );
    });
  });
});
