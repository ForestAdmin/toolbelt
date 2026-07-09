import type LayoutManager from '../../../src/services/layout/layout-manager';
import type { LayoutScope } from '../../../src/services/layout/types';
import type { SidecarFile } from '../../../src/services/layout/workflow-sidecar';

import { LayoutApiError } from '../../../src/services/layout/errors';
import {
  hasWorkflowBpmnOps,
  isSafeWorkflowId,
  partitionMissingSidecars,
  planSidecarUploads,
  resolveRemoteWorkflow,
  selectStaleSidecars,
  sidecarPath,
  stripWorkflowBpmnOps,
} from '../../../src/services/layout/workflow-sidecar';

const scope = {} as LayoutScope;

const managerWith = (getWorkflowBpmn: jest.Mock) =>
  ({ getWorkflowBpmn } as unknown as LayoutManager);

const sidecar = (over: Partial<SidecarFile['workflow']> = {}): SidecarFile => ({
  bpmn: '<bpmn:definitions />',
  workflow: { collectionId: 'aml_alerts', id: 'src-id', name: 'My workflow', ...over },
});

describe('isSafeWorkflowId', () => {
  it.each([
    ['a path-traversal id', '../x'],
    ['a slash-separated id', 'a/b'],
    ['a backslash-separated id', 'a\\b'],
    ['a dot-dot id', 'a..b'],
    ['an empty string', ''],
    ['a non-string id', 42],
    ['an undefined id', undefined],
  ])('rejects %s', (_label, id) => {
    expect.assertions(1);

    expect(isSafeWorkflowId(id)).toBe(false);
  });

  it.each([
    ['a numeric id', '123'],
    ['a uuid', 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab'],
  ])('accepts %s', (_label, id) => {
    expect.assertions(1);

    expect(isSafeWorkflowId(id)).toBe(true);
  });
});

describe('sidecarPath', () => {
  it('builds <dir>/<id>.bpmn for a safe id', () => {
    expect.assertions(1);

    expect(sidecarPath('/layout/workflows', 'wf1')).toBe('/layout/workflows/wf1.bpmn');
  });

  it('returns null for a traversal-unsafe id (never touches disk)', () => {
    expect.assertions(1);

    expect(sidecarPath('/layout/workflows', '../../etc/passwd')).toBeNull();
  });
});

describe('stripWorkflowBpmnOps', () => {
  it('drops replace ops targeting bpmnAwsS3Identifier', () => {
    expect.assertions(1);
    const ops = [
      { op: 'replace', path: '/workflows/wf1/bpmnAwsS3Identifier', value: 'v1' },
      { op: 'replace', path: '/workflows/wf1/name', value: 'Renamed' },
    ];

    expect(stripWorkflowBpmnOps(ops).map(op => op.path)).toStrictEqual(['/workflows/wf1/name']);
  });

  it('strips bpmnAwsS3Identifier from add values, keeping the other fields', () => {
    expect.assertions(1);
    const ops = [
      {
        op: 'add',
        path: '/workflows/-',
        value: { bpmnAwsS3Identifier: 'v1', id: 'wf1', name: 'W' },
      },
    ];

    expect(stripWorkflowBpmnOps(ops)[0].value).toStrictEqual({ id: 'wf1', name: 'W' });
  });

  it('leaves non-workflow ops untouched', () => {
    expect.assertions(1);
    const ops = [
      { op: 'replace', path: '/folders/12/name', value: 'Renamed' },
      { op: 'remove', path: '/workflows/wf1' },
    ];

    expect(stripWorkflowBpmnOps(ops)).toStrictEqual(ops);
  });
});

describe('hasWorkflowBpmnOps', () => {
  it('detects a replace of the bpmn pointer', () => {
    expect.assertions(1);

    expect(
      hasWorkflowBpmnOps([
        { op: 'replace', path: '/workflows/wf1/bpmnAwsS3Identifier', value: 'v1' },
      ]),
    ).toBe(true);
  });

  it('detects an added workflow carrying a bpmn pointer', () => {
    expect.assertions(1);

    expect(
      hasWorkflowBpmnOps([
        { op: 'add', path: '/workflows/-', value: { bpmnAwsS3Identifier: 'v1', id: 'wf1' } },
      ]),
    ).toBe(true);
  });

  it('ignores plans that never write a bpmn pointer', () => {
    expect.assertions(1);

    expect(
      hasWorkflowBpmnOps([
        { op: 'replace', path: '/workflows/wf1/name', value: 'W' },
        { op: 'add', path: '/workflows/-', value: { id: 'wf2', name: 'X' } },
        { op: 'replace', path: '/folders/12/name', value: 'F' },
      ]),
    ).toBe(false);
  });
});

describe('resolveRemoteWorkflow', () => {
  it('matches by id first', () => {
    expect.assertions(1);
    const remotes = [
      { id: 'src-id', name: 'Other' },
      { id: 'prod-id', name: 'My workflow' },
    ];

    expect(resolveRemoteWorkflow(remotes, { id: 'src-id', name: 'My workflow' })).toBe(remotes[0]);
  });

  it('falls back to name when no id matches (dev→prod promote)', () => {
    expect.assertions(1);
    const remotes = [{ id: 'prod-id', name: 'My workflow' }];

    expect(resolveRemoteWorkflow(remotes, { id: 'src-id', name: 'My workflow' })).toBe(remotes[0]);
  });

  it('returns undefined when neither id nor name matches', () => {
    expect.assertions(1);

    expect(
      resolveRemoteWorkflow([{ id: 'x', name: 'Y' }], { id: 'src-id', name: 'My workflow' }),
    ).toBeUndefined();
  });

  it('resolves duplicate names to the LAST remote, exactly like the domain patch', () => {
    expect.assertions(1);
    // Two same-name workflows in the target: the diff engine's Map keeps the
    // last one, so the sidecar upload must target that same workflow — not the
    // first — or the BPMN and the metadata patch would land on different ones.
    const remotes = [
      { id: 'prod-1', name: 'My workflow' },
      { id: 'prod-2', name: 'My workflow' },
    ];

    expect(resolveRemoteWorkflow(remotes, { id: 'src-id', name: 'My workflow' })).toBe(remotes[1]);
  });
});

describe('partitionMissingSidecars', () => {
  it('splits missing sidecars by whether the target env already has the workflow', () => {
    expect.assertions(1);
    const remotes = [{ id: 'prod-1', name: 'Existing' }];
    const missing = [
      { id: 'src-1', name: 'Existing' }, // name-matched: the target keeps its own BPMN
      { id: 'src-2', name: 'Brand new' }, // added by this apply: created with NO BPMN
    ];

    expect(partitionMissingSidecars(missing, remotes)).toStrictEqual({
      createdWithoutBpmn: [{ id: 'src-2', name: 'Brand new' }],
      targetKeepsOwn: [{ id: 'src-1', name: 'Existing' }],
    });
  });
});

describe('planSidecarUploads', () => {
  it('skips the upload when the stored BPMN already matches, on an id match (idempotent)', async () => {
    expect.assertions(2);
    const plan = sidecar();
    const getWorkflowBpmn = jest.fn().mockResolvedValue(plan.bpmn);

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [plan],
      [{ bpmnAwsS3Identifier: 'v1', collectionId: 'aml_alerts', id: 'src-id' }],
      7,
    );

    expect(uploads).toStrictEqual([]);
    expect(getWorkflowBpmn).toHaveBeenCalledWith(scope, 'src-id', 'aml_alerts', 'v1', 7);
  });

  it('resolves a same-name workflow to the TARGET id and stays idempotent (promote)', async () => {
    expect.assertions(2);
    const plan = sidecar();
    const getWorkflowBpmn = jest.fn().mockResolvedValue(plan.bpmn);

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [plan],
      [
        {
          bpmnAwsS3Identifier: 'prod-v',
          collectionId: 'aml_alerts',
          id: 'prod-id',
          name: 'My workflow',
        },
      ],
      7,
    );

    // Idempotence must hold even when the ids differ: the stored bytes are
    // fetched under the TARGET id and match, so nothing is re-uploaded.
    expect(uploads).toStrictEqual([]);
    expect(getWorkflowBpmn).toHaveBeenCalledWith(scope, 'prod-id', 'aml_alerts', 'prod-v', 7);
  });

  it('uploads a changed sidecar to the name-matched TARGET workflow, never the source id', async () => {
    expect.assertions(1);
    const plan = sidecar();
    const getWorkflowBpmn = jest.fn().mockResolvedValue('<bpmn:definitions>old</bpmn:definitions>');

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [plan],
      [
        {
          bpmnAwsS3Identifier: 'prod-v',
          collectionId: 'prod_col',
          id: 'prod-id',
          name: 'My workflow',
        },
      ],
      7,
    );

    expect(uploads[0].target).toStrictEqual({ collectionId: 'prod_col', id: 'prod-id' });
  });

  it('keeps an unmatched sidecar with a null target (workflow added by this apply)', async () => {
    expect.assertions(2);
    const getWorkflowBpmn = jest.fn();

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [sidecar()],
      [],
      7,
    );

    expect(uploads[0].target).toBeNull();
    expect(getWorkflowBpmn).not.toHaveBeenCalled();
  });

  it('uploads without fetching when the target workflow has no stored BPMN yet', async () => {
    expect.assertions(2);
    const getWorkflowBpmn = jest.fn();

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [sidecar()],
      [{ collectionId: 'aml_alerts', id: 'src-id' }],
      7,
    );

    expect(uploads[0].target).toStrictEqual({ collectionId: 'aml_alerts', id: 'src-id' });
    expect(getWorkflowBpmn).not.toHaveBeenCalled();
  });

  it('re-uploads when the stored BPMN cannot be read (rather than risk a stale skip)', async () => {
    expect.assertions(1);
    const getWorkflowBpmn = jest.fn().mockRejectedValue(new LayoutApiError(404, 'gone'));

    const uploads = await planSidecarUploads(
      managerWith(getWorkflowBpmn),
      scope,
      [sidecar()],
      [{ bpmnAwsS3Identifier: 'v1', collectionId: 'aml_alerts', id: 'src-id' }],
      7,
    );

    expect(uploads).toHaveLength(1);
  });

  it('surfaces auth failures instead of reframing them as "changed"', async () => {
    expect.assertions(1);
    const getWorkflowBpmn = jest.fn().mockRejectedValue(new LayoutApiError(403, 'forbidden'));

    await expect(
      planSidecarUploads(
        managerWith(getWorkflowBpmn),
        scope,
        [sidecar()],
        [{ bpmnAwsS3Identifier: 'v1', collectionId: 'aml_alerts', id: 'src-id' }],
        7,
      ),
    ).rejects.toThrow('403');
  });
});

describe('selectStaleSidecars', () => {
  const STALE_UUID = '01234567-89ab-cdef-0123-456789abcdef';

  it('selects only managed sidecars whose workflow no longer exists in the env', () => {
    expect.assertions(1);
    const entries = ['42.bpmn', `${STALE_UUID}.bpmn`];

    expect(selectStaleSidecars(entries, new Set(['42']))).toStrictEqual([`${STALE_UUID}.bpmn`]);
  });

  it('preserves sidecars of workflows still in the env even when their download was skipped', () => {
    expect.assertions(1);
    // The uuid workflow was skipped (404 on S3) but still exists: its sidecar
    // may be the last copy of the BPMN — never prune it.
    const keep = new Set(['42', STALE_UUID]);

    expect(selectStaleSidecars(['42.bpmn', `${STALE_UUID}.bpmn`], keep)).toStrictEqual([]);
  });

  it('never touches files that do not look like a managed sidecar', () => {
    expect.assertions(1);
    const entries = ['notes.txt', 'draft..v2.bpmn', '.bpmn', 'diagram.bpmn.bak'];

    expect(selectStaleSidecars(entries, new Set())).toStrictEqual([]);
  });

  it("preserves a user's own hand-named BPMN files (not server-id shaped)", () => {
    expect.assertions(1);
    // `review.bpmn` is traversal-safe but was never written by pull (sidecars
    // are named after NUM_OR_UUID server ids) — pull must never delete it.
    const entries = ['review.bpmn', 'my-draft.bpmn', '7.bpmn'];

    expect(selectStaleSidecars(entries, new Set())).toStrictEqual(['7.bpmn']);
  });
});
