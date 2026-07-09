import type LayoutManager from '../../../src/services/layout/layout-manager';
import type { LayoutScope } from '../../../src/services/layout/types';

import { planWorkflowBpmn, stepWorkflows } from '../../../src/services/layout/sync';
import { compileWorkflowToBpmn } from '../../../src/services/layout/workflow-bpmn';

const scope = {} as LayoutScope;

/** A step-workflow with a valid (compilable) two-step graph. */
const makeWorkflow = (over: Record<string, unknown> = {}) => ({
  collectionId: 'aml_alerts',
  id: 'wf1',
  name: 'My workflow',
  segmentIds: [],
  steps: [
    { id: 'start', type: 'guidance', prompt: 'Review', next: 'done' },
    { id: 'done', type: 'end' },
  ],
  ...over,
});

const compiledBpmn = (wf: ReturnType<typeof makeWorkflow>) =>
  compileWorkflowToBpmn({
    collection: wf.collectionId,
    name: wf.name,
    segments: wf.segmentIds,
    steps: wf.steps as never,
  });

const managerWith = (getWorkflowBpmn: jest.Mock) =>
  ({ getWorkflowBpmn } as unknown as LayoutManager);

describe('planWorkflowBpmn', () => {
  it('skips the upload when the stored BPMN already matches the compiled one (idempotent)', async () => {
    expect.assertions(2);
    const wf = makeWorkflow();
    const getWorkflowBpmn = jest.fn().mockResolvedValue(compiledBpmn(wf));

    const [plan] = await planWorkflowBpmn(
      managerWith(getWorkflowBpmn),
      scope,
      [wf],
      [{ id: 'wf1', bpmnAwsS3Identifier: 'v1' }],
      7,
    );

    expect(plan.changed).toBe(false);
    expect(getWorkflowBpmn).toHaveBeenCalledTimes(1);
  });

  it('uploads when the stored BPMN differs from the compiled one', async () => {
    expect.assertions(1);
    const wf = makeWorkflow();
    const getWorkflowBpmn = jest.fn().mockResolvedValue('<bpmn:definitions />');

    const [plan] = await planWorkflowBpmn(
      managerWith(getWorkflowBpmn),
      scope,
      [wf],
      [{ id: 'wf1', bpmnAwsS3Identifier: 'v1' }],
      7,
    );

    expect(plan.changed).toBe(true);
  });

  it('uploads a brand-new workflow without fetching (no stored version)', async () => {
    expect.assertions(2);
    const wf = makeWorkflow();
    const getWorkflowBpmn = jest.fn();

    const [plan] = await planWorkflowBpmn(managerWith(getWorkflowBpmn), scope, [wf], [], 7);

    expect(plan.changed).toBe(true);
    expect(getWorkflowBpmn).not.toHaveBeenCalled();
  });

  it('compiles the entry flow from `start`, not from the first step', async () => {
    expect.assertions(2);
    const wf = makeWorkflow({
      start: 'review',
      steps: [
        { id: 'notes', type: 'guidance', prompt: 'Notes', next: 'done' },
        { id: 'review', type: 'guidance', prompt: 'Review', next: 'notes' },
        { id: 'done', type: 'end' },
      ],
    });

    const [plan] = await planWorkflowBpmn(managerWith(jest.fn()), scope, [wf], [], 7);

    expect(plan.bpmn).toContain('sourceRef="Start_1" targetRef="review"');
    expect(plan.bpmn).not.toContain('sourceRef="Start_1" targetRef="notes"');
  });

  it('re-uploads when the stored BPMN cannot be read (rather than risk a stale skip)', async () => {
    expect.assertions(1);
    const wf = makeWorkflow();
    const getWorkflowBpmn = jest.fn().mockRejectedValue(new Error('S3 unreachable'));

    const [plan] = await planWorkflowBpmn(
      managerWith(getWorkflowBpmn),
      scope,
      [wf],
      [{ id: 'wf1', bpmnAwsS3Identifier: 'v1' }],
      7,
    );

    expect(plan.changed).toBe(true);
  });
});

describe('stepWorkflows', () => {
  it('keeps only workflows that carry a non-empty steps graph', () => {
    expect.assertions(1);
    const file = {
      workflows: [
        { collectionId: 'c', id: 'a', name: 'A', steps: [{ id: 's', type: 'end' }] },
        { collectionId: 'c', id: 'b', name: 'B' },
        { collectionId: 'c', id: 'd', name: 'D', steps: [] },
      ],
    };

    expect(stepWorkflows(file).map(workflow => workflow.id)).toStrictEqual(['a']);
  });

  it('passes the authored `start` through (and ignores a non-string one)', () => {
    expect.assertions(2);
    const file = {
      workflows: [
        { collectionId: 'c', id: 'a', name: 'A', start: 's', steps: [{ id: 's', type: 'end' }] },
        { collectionId: 'c', id: 'b', name: 'B', start: 42, steps: [{ id: 's', type: 'end' }] },
      ],
    };

    const [withStart, withBadStart] = stepWorkflows(file);

    expect(withStart.start).toBe('s');
    expect(withBadStart.start).toBeUndefined();
  });

  it('assigns a uuid in place to a steps-carrying workflow lacking an id', () => {
    expect.assertions(2);
    const workflow: Record<string, unknown> = {
      collectionId: 'c',
      name: 'W',
      steps: [{ id: 's', type: 'end' }],
    };
    const file = { workflows: [workflow] };

    const [resolved] = stepWorkflows(file);

    expect(resolved.id).toMatch(/^[0-9a-f-]{36}$/);
    // The doc is mutated so the shell `add` and the BPMN link target the same id.
    expect(workflow.id).toBe(resolved.id);
  });
});
