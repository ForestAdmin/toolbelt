import { diffDomain } from '../../../src/services/layout/diff';

type AnyRecord = Record<string, unknown>;

/** A canonical layout document with one fully-populated collection. */
function baseLayout(): AnyRecord {
  return {
    collections: [
      {
        defaultSortingFieldName: 'id',
        defaultSortingOrder: 'ascending',
        displayName: 'Clients',
        displayNamePlural: null,
        icon: 'user',
        id: 'customers',
        layout: {
          actions: [{ id: 'act1', isVisible: true, name: 'Refund', position: 0 }],
          columns: [
            { id: 'id', isVisible: false, position: 0 },
            { id: 'email', isVisible: true, position: 1 },
          ],
          fields: [{ displayName: 'E-mail', id: 'email', isReadOnly: true, widgetEdit: null }],
          segments: [{ id: 'seg1', name: 'VIP' }],
          viewEdit: { summaryView: null },
        },
        restrictedToSegments: false,
      },
    ],
    dashboards: [],
    sections: [],
  };
}

const clone = (value: AnyRecord): AnyRecord => JSON.parse(JSON.stringify(value));

describe('diffDomain (layout)', () => {
  it('is idempotent: identical documents produce no operation', () => {
    expect.assertions(2);
    const { ops, warnings } = diffDomain('layout', baseLayout(), clone(baseLayout()));
    expect(ops).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
  });

  it('emits a replace for a changed scalar', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    (local.collections as AnyRecord[])[0].displayName = 'Customers';

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops).toStrictEqual([
      expect.objectContaining({
        op: 'replace',
        path: '/collections/customers/displayName',
        value: 'Customers',
      }),
    ]);
  });

  it('emits a replace for a column visibility change (addressed by id)', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).columns = [
      { id: 'id', isVisible: false, position: 0 },
      { id: 'email', isVisible: false, position: 1 },
    ];

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops).toStrictEqual([
      expect.objectContaining({
        op: 'replace',
        path: '/collections/customers/layout/columns/email/isVisible',
        value: false,
      }),
    ]);
  });

  it('treats complex values as opaque and replaces them wholesale', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    (
      ((local.collections as AnyRecord[])[0].layout as AnyRecord).fields as AnyRecord[]
    )[0].widgetEdit = {
      format: 'rich',
    };

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops).toStrictEqual([
      expect.objectContaining({
        op: 'replace',
        path: '/collections/customers/layout/fields/email/widgetEdit',
        value: { format: 'rich' },
      }),
    ]);
  });

  it('adds a new segment: keeps a generated id and fills write-required defaults', () => {
    expect.assertions(4);
    const local = clone(baseLayout());
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).segments = [
      { id: 'seg1', name: 'VIP' },
      { name: 'New segment' },
    ];

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('add');
    expect(ops[0].path).toBe('/collections/customers/layout/segments/-');
    const value = ops[0].value as AnyRecord;
    // The server requires a client id + a full segment shape on add; the engine
    // generates a uuid and fills the fields the rendering read omits.
    expect(value).toStrictEqual(
      expect.objectContaining({
        columns: [],
        defaultSortingFieldName: null,
        defaultSortingFieldOrder: null,
        filter: null,
        hasColumnsConfiguration: false,
        icon: null,
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'New segment',
        query: null,
        type: 'manual',
      }),
    );
  });

  it('preserves an authored id on add (stable across re-apply / cross-env copy)', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).segments = [
      { id: 'seg1', name: 'VIP' },
      { id: 'my-fixed-id', name: 'Authored', type: 'smart', query: 'SELECT 1' },
    ];

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect((ops[0].value as AnyRecord).id).toBe('my-fixed-id');
  });

  it('removes a segment missing from the local document', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).segments = [];

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops).toStrictEqual([
      expect.objectContaining({
        op: 'remove',
        path: '/collections/customers/layout/segments/seg1',
      }),
    ]);
  });

  it('warns instead of emitting when adding to a non-addable array (columns)', () => {
    expect.assertions(2);
    const local = clone(baseLayout());
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).columns = [
      { id: 'id', isVisible: false, position: 0 },
      { id: 'email', isVisible: true, position: 1 },
      { id: 'extra', isVisible: true, position: 2 },
    ];

    const { ops, warnings } = diffDomain('layout', baseLayout(), local);
    expect(ops).toStrictEqual([]);
    expect(warnings[0]).toContain('cannot add');
  });

  it('orders operations add → replace → remove', () => {
    expect.assertions(1);
    const local = clone(baseLayout());
    (local.collections as AnyRecord[])[0].displayName = 'Customers'; // replace
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).segments = [
      { name: 'New segment' },
    ]; // add + remove seg1

    const { ops } = diffDomain('layout', baseLayout(), local);
    expect(ops.map(op => op.op)).toStrictEqual(['add', 'replace', 'remove']);
  });

  it('creates a workflow shell with a generated id and filled defaults (workflows domain)', () => {
    expect.assertions(3);
    const remote: AnyRecord[] = [];
    const local: AnyRecord[] = [{ collectionId: 'aml_alerts', name: 'My workflow' }];

    const { ops } = diffDomain('workflows', remote, local);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toStrictEqual(expect.objectContaining({ op: 'add', path: '/workflows/-' }));
    expect(ops[0].value).toStrictEqual(
      expect.objectContaining({
        collectionId: 'aml_alerts',
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        isVisible: true,
        name: 'My workflow',
        position: 0,
        segmentIds: [],
      }),
    );
  });

  it('matches items by name when neither side has an id', () => {
    expect.assertions(1);
    const remote = baseLayout();
    const local = clone(baseLayout());
    ((remote.collections as AnyRecord[])[0].layout as AnyRecord).segments = [{ name: 'VIP' }];
    ((local.collections as AnyRecord[])[0].layout as AnyRecord).segments = [{ name: 'VIP' }];

    const { ops } = diffDomain('layout', remote, local);
    expect(ops).toStrictEqual([]);
  });
});
