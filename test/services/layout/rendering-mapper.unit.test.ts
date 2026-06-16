import { renderingToCanonical } from '../../../src/services/layout/rendering-mapper';

/** Minimal JSON:API rendering covering the mapped element types. */
function sampleRendering() {
  return {
    data: { attributes: { sections: [{ id: 's1', name: 'Sales' }] }, id: '42', type: 'renderings' },
    included: [
      {
        attributes: {
          default_sorting_field_order: 'ascending',
          display_name: 'Clients',
          icon: 'user',
          restricted_to_segments: false,
        },
        id: 'customers',
        relationships: {
          columns: {
            data: [
              { id: 'customers-email', type: 'columns' },
              { id: 'customers-id', type: 'columns' },
            ],
          },
          custom_actions: { data: [{ id: 'act1', type: 'customActions' }] },
          default_sorting_field: { data: { id: 'customers-id', type: 'fields' } },
          fields: { data: [{ id: 'customers-email', type: 'fields' }] },
          segments: { data: [{ id: 'seg1', type: 'segments' }] },
        },
        type: 'collections',
      },
      { attributes: { is_hidden: false, position: 1 }, id: 'customers-email', type: 'columns' },
      { attributes: { is_hidden: true, position: 0 }, id: 'customers-id', type: 'columns' },
      {
        attributes: { display_name: 'E-mail', field: 'email', is_read_only: true },
        id: 'customers-email',
        type: 'fields',
      },
      { attributes: { name: 'VIP' }, id: 'seg1', type: 'segments' },
      { attributes: { name: 'Refund' }, id: 'act1', type: 'customActions' },
      { attributes: { summary_view: { fields: ['email'] } }, id: 'customers', type: 'viewEdits' },
      { attributes: { icon: 'chart', name: 'KPIs' }, id: 'dash1', type: 'dashboards' },
    ],
  };
}

describe('renderingToCanonical', () => {
  it('maps collection base attributes to camelCase', () => {
    expect.assertions(1);
    const { collections } = renderingToCanonical(sampleRendering());
    expect(collections[0]).toMatchObject({
      defaultSortingOrder: 'ascending',
      displayName: 'Clients',
      icon: 'user',
      id: 'customers',
      restrictedToSegments: false,
    });
  });

  it('strips the collection prefix from column ids and sorts by position', () => {
    expect.assertions(1);
    const { collections } = renderingToCanonical(sampleRendering());
    expect(collections[0].layout.columns).toStrictEqual([
      { id: 'id', isVisible: false, position: 0 },
      { id: 'email', isVisible: true, position: 1 },
    ]);
  });

  it('inverts is_hidden into isVisible', () => {
    expect.assertions(2);
    const { collections } = renderingToCanonical(sampleRendering());
    const byId = Object.fromEntries(collections[0].layout.columns.map(c => [c.id, c.isVisible]));
    expect(byId.id).toBe(false); // is_hidden: true
    expect(byId.email).toBe(true); // is_hidden: false
  });

  it('maps field patchable keys to camelCase and uses the field name as id', () => {
    expect.assertions(1);
    const { collections } = renderingToCanonical(sampleRendering());
    expect(collections[0].layout.fields[0]).toStrictEqual({
      displayName: 'E-mail',
      id: 'email',
      isReadOnly: true,
    });
  });

  it('resolves defaultSortingFieldName from the relationship (prefix stripped)', () => {
    expect.assertions(1);
    const { collections } = renderingToCanonical(sampleRendering());
    expect(collections[0].defaultSortingFieldName).toBe('id');
  });

  it('maps segments, actions, dashboards and sections', () => {
    expect.assertions(4);
    const { collections, dashboards, sections } = renderingToCanonical(sampleRendering());
    expect(collections[0].layout.segments).toStrictEqual([{ id: 'seg1', name: 'VIP' }]);
    expect(collections[0].layout.actions).toStrictEqual([{ id: 'act1', name: 'Refund' }]);
    expect(dashboards).toStrictEqual([{ icon: 'chart', id: 'dash1', name: 'KPIs' }]);
    expect(sections).toStrictEqual([{ id: 's1', name: 'Sales' }]);
  });

  it('tolerates an empty rendering', () => {
    expect.assertions(1);
    expect(
      renderingToCanonical({ data: { attributes: {}, id: '1', type: 'renderings' } }),
    ).toStrictEqual({
      collections: [],
      dashboards: [],
      sections: [],
    });
  });
});
