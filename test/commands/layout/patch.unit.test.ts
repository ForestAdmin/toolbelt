import { buildAllOps, formatOps, toPlannedOps } from '../../../src/commands/layout/patch';

describe('toPlannedOps', () => {
  it('accepts a valid add op', () => {
    expect.assertions(4);
    const ops = toPlannedOps('layout', [
      {
        op: 'add',
        path: '/collections/orders/layout/segments/-',
        value: { id: 'seg1', name: 'VIP' },
      },
    ]);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('add');
    expect(ops[0].domain).toBe('layout');
    expect(ops[0].jsonPath).toBe('/collections/orders/layout/segments/-');
  });

  it('accepts a valid replace op', () => {
    expect.assertions(2);
    const ops = toPlannedOps('layout', [
      { op: 'replace', path: '/collections/orders/displayName', value: 'Orders v2' },
    ]);
    expect(ops[0].op).toBe('replace');
    expect(ops[0].label).toBe('replace /collections/orders/displayName');
  });

  it('rejects an unknown op type', () => {
    expect.assertions(1);
    expect(() =>
      toPlannedOps('layout', [{ op: 'upsert', path: '/collections/orders/displayName' }]),
    ).toThrow(/unknown op "upsert"/);
  });

  it('rejects a path that does not start with "/"', () => {
    expect.assertions(1);
    expect(() =>
      toPlannedOps('layout', [{ op: 'replace', path: 'collections/orders/displayName' }]),
    ).toThrow(/path must be a string starting with/);
  });

  it('rejects a path outside the server whitelist', () => {
    expect.assertions(1);
    expect(() =>
      toPlannedOps('layout', [
        { op: 'replace', path: '/collections/orders/__internal__', value: 'x' },
      ]),
    ).toThrow(/not allowed by the server whitelist/);
  });

  it('rejects a non-object operation with a user-facing error', () => {
    expect.assertions(1);
    expect(() => toPlannedOps('layout', [null as unknown as { op: string; path: string }])).toThrow(
      /each operation must be a JSON object/,
    );
  });
});

describe('buildAllOps', () => {
  it('collects ops from layout and folders in domain order', () => {
    expect.assertions(3);
    const ops = buildAllOps({
      folders: [{ op: 'add', path: '/folders/12/children/-', value: { id: 'f1', name: 'Sales' } }],
      layout: [{ op: 'replace', path: '/collections/orders/displayName', value: 'Orders v2' }],
    });
    expect(ops).toHaveLength(2);
    expect(ops[0].domain).toBe('layout');
    expect(ops[1].domain).toBe('folders');
  });

  it('returns an empty array when input has no ops', () => {
    expect.assertions(1);
    expect(buildAllOps({})).toHaveLength(0);
  });

  it('throws when a domain value is not an array', () => {
    expect.assertions(1);
    expect(() =>
      buildAllOps({ layout: 'bad' as unknown as Array<{ op: string; path: string }> }),
    ).toThrow(/"layout" must be an array/);
  });

  it('rejects the workflows domain (deferred to apply)', () => {
    expect.assertions(1);
    expect(() =>
      buildAllOps({ workflows: [{ op: 'replace', path: '/workflows/42/isVisible', value: true }] }),
    ).toThrow(/"workflows" domain is not supported/);
  });

  it('rejects an unknown domain key instead of silently dropping it', () => {
    expect.assertions(1);
    expect(() =>
      buildAllOps({
        layuot: [{ op: 'replace', path: '/collections/orders/displayName', value: 'x' }],
      } as unknown as Parameters<typeof buildAllOps>[0]),
    ).toThrow(/Unknown domain key: layuot/);
  });
});

describe('formatOps', () => {
  it('groups ops by domain with a singular count', () => {
    expect.assertions(1);
    const ops = buildAllOps({
      layout: [{ op: 'replace', path: '/collections/orders/displayName', value: 'Orders v2' }],
    });
    expect(formatOps(ops)).toContain('layout (1 op)');
  });

  it('uses plural for multiple ops', () => {
    expect.assertions(1);
    const ops = buildAllOps({
      layout: [
        { op: 'replace', path: '/collections/orders/displayName', value: 'A' },
        { op: 'replace', path: '/collections/orders/icon', value: 'truck' },
      ],
    });
    expect(formatOps(ops)).toContain('layout (2 ops)');
  });
});
