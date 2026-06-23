import { diffDomain } from '../../../src/services/layout/diff';

/** A folders document with a main (singleton) folder + the given named folders. */
const foldersDoc = (mainId: string, named: Array<{ icon: string; id: string; name: string }>) => [
  { id: mainId, isMain: true, children: [] },
  ...named.map(folder => ({ ...folder, isMain: false, children: [] })),
];

describe('diffDomain — absent remote domain', () => {
  const folders = [{ icon: '📁', id: '99999999-9999-9999-9999-999999999999', name: 'Solo' }];

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
  ])('does not throw when the remote folders document is %s', (_label, remote) => {
    expect.assertions(1);

    expect(() => diffDomain('folders', remote, folders)).not.toThrow();
  });

  it('treats a missing remote folders document as an empty list (everything added)', () => {
    expect.assertions(1);
    const { ops } = diffDomain('folders', undefined, folders);

    expect(ops).toContainEqual(expect.objectContaining({ op: 'add', path: '/folders/-' }));
  });
});

describe('diffDomain — folders main (singleton) matching', () => {
  it('never adds/removes the main folder when its id differs across environments', () => {
    expect.assertions(2);
    const remote = foldersDoc('remote-main', []);
    const local = foldersDoc('local-main', []);

    const { ops } = diffDomain('folders', remote, local);

    // The two main folders are matched by `isMain`, not by their (per-env) id.
    expect(ops.some(op => op.op === 'add' && op.path === '/folders/-')).toBe(false);
    expect(ops.some(op => op.op === 'remove' && op.path === '/folders/remote-main')).toBe(false);
  });

  it('adds a named folder absent from the remote and removes one only on the remote', () => {
    expect.assertions(2);
    const oldId = '11111111-1111-1111-1111-111111111111';
    const remote = foldersDoc('22222222-2222-2222-2222-222222222222', [
      { icon: '📁', id: oldId, name: 'Old' },
    ]);
    const local = foldersDoc('33333333-3333-3333-3333-333333333333', [
      { icon: '🔎', id: '44444444-4444-4444-4444-444444444444', name: 'New' },
    ]);

    const { ops } = diffDomain('folders', remote, local);

    expect(ops).toContainEqual(expect.objectContaining({ op: 'add', path: '/folders/-' }));
    expect(ops).toContainEqual(
      expect.objectContaining({ op: 'remove', path: `/folders/${oldId}` }),
    );
  });

  it('produces no op when the document is identical (idempotent re-apply)', () => {
    expect.assertions(1);
    const doc = foldersDoc('55555555-5555-5555-5555-555555555555', [
      { icon: '📁', id: '66666666-6666-6666-6666-666666666666', name: 'A' },
    ]);

    const { ops } = diffDomain('folders', doc, doc);

    expect(ops).toHaveLength(0);
  });
});

describe('diffDomain — workspace component options', () => {
  const wsId = '77777777-7777-7777-7777-777777777777';
  const compId = '88888888-8888-8888-8888-888888888888';
  const layout = (showCreate: boolean) => ({
    workspaces: [
      {
        id: wsId,
        name: 'Onboarding',
        components: [
          {
            id: compId,
            name: 'KYC',
            type: 'collection',
            options: { collectionId: 'kyc_cases', showCreate },
          },
        ],
      },
    ],
  });

  it('emits a whitelisted replace on the deep `options` object when it changes', () => {
    expect.assertions(2);
    const { ops } = diffDomain('layout', layout(false), layout(true));

    expect(ops).toHaveLength(1);
    expect(ops[0]).toStrictEqual(
      expect.objectContaining({
        op: 'replace',
        path: `/workspaces/${wsId}/components/${compId}/options`,
      }),
    );
  });

  it('emits nothing when `options` is unchanged', () => {
    expect.assertions(1);
    const { ops } = diffDomain('layout', layout(true), layout(true));

    expect(ops).toHaveLength(0);
  });
});
