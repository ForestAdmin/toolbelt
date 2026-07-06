import type { RemoteWorkflow } from '../../../src/services/layout/workflow-apply';

import {
  findWorkflowMatches,
  parseWorkflowSpec,
  planShellUpdate,
} from '../../../src/services/layout/workflow-apply';
import { WorkflowSpecError } from '../../../src/services/layout/workflow-bpmn';

const validSpec = {
  collection: 'cards',
  name: 'Triage',
  steps: [
    { id: 'read1', next: 'done', type: 'read' },
    { id: 'done', type: 'end' },
  ],
};

describe('parseWorkflowSpec', () => {
  it('accepts a valid spec and returns it', () => {
    expect.assertions(1);

    expect(parseWorkflowSpec(JSON.stringify(validSpec))).toStrictEqual(validSpec);
  });

  it('accepts version 1 and the documented optional fields', () => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      id: '123',
      position: 3,
      segments: ['s1'],
      start: 'read1',
      version: 1,
    };

    expect(parseWorkflowSpec(JSON.stringify(spec))).toStrictEqual(spec);
  });

  it.each([
    ['invalid JSON', '{ oops', 'Invalid JSON in spec:'],
    ['a JSON string', '"foo"', 'The spec must be a JSON object'],
    ['null', 'null', 'The spec must be a JSON object'],
    ['an array', '[1, 2]', 'The spec must be a JSON object'],
  ])('rejects %s with a clean message', (label, raw, message) => {
    expect.assertions(2);

    expect(() => parseWorkflowSpec(raw)).toThrow(WorkflowSpecError);
    expect(() => parseWorkflowSpec(raw)).toThrow(message);
  });

  it('rejects unsupported spec versions', () => {
    expect.assertions(1);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, version: 2 }))).toThrow(
      'Unsupported spec `version` 2',
    );
  });

  it('rejects an unknown top-level field with a suggestion', () => {
    expect.assertions(1);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, segmentss: [] }))).toThrow(
      'Unknown field "segmentss" — did you mean `segments`?',
    );
  });

  it('lists the valid fields when no suggestion is close enough', () => {
    expect.assertions(1);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, whatever: 1 }))).toThrow(
      'valid fields: collection, id, name, position, segments, start, steps, version.',
    );
  });

  it('rejects an unknown step field with a suggestion', () => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      steps: [
        { autocomplete: true, id: 'read1', next: 'done', type: 'read' },
        { id: 'done', type: 'end' },
      ],
    };

    expect(() => parseWorkflowSpec(JSON.stringify(spec))).toThrow(
      'Unknown field "autocomplete" in step "read1" — did you mean `autoComplete`?',
    );
  });

  it('rejects an unknown branch field', () => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      steps: [
        {
          branches: [
            { answer: 'Yes', nxt: 'done' },
            { answer: 'No', next: 'done' },
          ],
          id: 'cond1',
          type: 'condition',
        },
        { id: 'done', type: 'end' },
      ],
    };

    expect(() => parseWorkflowSpec(JSON.stringify(spec))).toThrow(
      'Unknown field "nxt" in step "cond1" — did you mean `next`?',
    );
  });

  it('rejects a non-object step', () => {
    expect.assertions(1);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, steps: ['read1'] }))).toThrow(
      '`steps[0]` must be a JSON object.',
    );
  });

  it.each([
    ['a non-numeric, non-UUID id', { id: 'my-workflow' }],
    ['a numeric id given as a number', { id: 42 }],
  ])('rejects %s', (label, extra) => {
    expect.assertions(1);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, ...extra }))).toThrow(
      '`id` must be an existing workflow id',
    );
  });

  it('accepts a UUID id', () => {
    expect.assertions(1);

    const id = '6f2c48d0-9d2e-4d0a-a1de-111111111111';

    expect(parseWorkflowSpec(JSON.stringify({ ...validSpec, id })).id).toBe(id);
  });

  it.each([
    ['a non-string `name`', { name: 123 }, '`name` must be a string (got 123).'],
    [
      'a non-string `collection`',
      { collection: false },
      '`collection` must be a string (got false).',
    ],
    ['a non-string `start`', { start: 1 }, '`start` must be a string (got 1).'],
    [
      'a non-array `segments`',
      { segments: 'vip' },
      '`segments` must be an array of segment ids (strings) (got "vip").',
    ],
    [
      'a `segments` array holding non-strings',
      { segments: [1] },
      '`segments` must be an array of segment ids (strings) (got [1]).',
    ],
  ])('rejects %s', (label, extra, message) => {
    expect.assertions(2);
    const raw = JSON.stringify({ ...validSpec, ...extra });

    expect(() => parseWorkflowSpec(raw)).toThrow(WorkflowSpecError);
    expect(() => parseWorkflowSpec(raw)).toThrow(message);
  });

  it.each([
    [
      '`mcpServerId`',
      { mcpServerId: 123 },
      '`mcpServerId` must be a string in step "read1" (got 123).',
    ],
    ['`prompt`', { prompt: ['a'] }, '`prompt` must be a string in step "read1" (got ["a"]).'],
    ['`title`', { title: 7 }, '`title` must be a string in step "read1" (got 7).'],
    ['`next`', { next: 42 }, '`next` must be a string in step "read1" (got 42).'],
    ['`type`', { type: 5 }, '`type` must be a string in step "read1" (got 5).'],
    ['`inboxId`', { inboxId: {} }, '`inboxId` must be a string in step "read1" (got {}).'],
    ['`auto`', { auto: 'yes' }, '`auto` must be a boolean in step "read1" (got "yes").'],
    [
      '`autoComplete`',
      { autoComplete: 1 },
      '`autoComplete` must be a boolean in step "read1" (got 1).',
    ],
  ])('rejects a wrongly-typed step %s with a clean message', (label, extra, message) => {
    expect.assertions(2);
    const raw = JSON.stringify({
      ...validSpec,
      steps: [
        { ...validSpec.steps[0], ...extra },
        { id: 'done', type: 'end' },
      ],
    });

    expect(() => parseWorkflowSpec(raw)).toThrow(WorkflowSpecError);
    expect(() => parseWorkflowSpec(raw)).toThrow(message);
  });

  it('rejects a non-array `branches`', () => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      steps: [
        { branches: 'nope', id: 'cond1', type: 'condition' },
        { id: 'done', type: 'end' },
      ],
    };

    expect(() => parseWorkflowSpec(JSON.stringify(spec))).toThrow(
      '`branches` must be an array in step "cond1" (got "nope").',
    );
  });

  it('rejects a non-object branch', () => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      steps: [
        { branches: ['done'], id: 'cond1', type: 'condition' },
        { id: 'done', type: 'end' },
      ],
    };

    expect(() => parseWorkflowSpec(JSON.stringify(spec))).toThrow(
      '`branches[0]` must be a JSON object in step "cond1".',
    );
  });

  it.each([
    ['`answer`', { answer: 1, next: 'done' }, '`answer` must be a string in step "cond1" (got 1).'],
    [
      '`color`',
      { answer: 'Yes', color: 0, next: 'done' },
      '`color` must be a string in step "cond1" (got 0).',
    ],
    [
      '`next`',
      { answer: 'Yes', next: true },
      '`next` must be a string in step "cond1" (got true).',
    ],
  ])('rejects a wrongly-typed branch %s with a clean message', (label, branch, message) => {
    expect.assertions(1);

    const spec = {
      ...validSpec,
      steps: [
        { branches: [branch, { answer: 'No', next: 'done' }], id: 'cond1', type: 'condition' },
        { id: 'done', type: 'end' },
      ],
    };

    expect(() => parseWorkflowSpec(JSON.stringify(spec))).toThrow(message);
  });

  it('rejects a negative or fractional position', () => {
    expect.assertions(2);

    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, position: -1 }))).toThrow(
      '`position` must be a non-negative integer',
    );
    expect(() => parseWorkflowSpec(JSON.stringify({ ...validSpec, position: 1.5 }))).toThrow(
      '`position` must be a non-negative integer',
    );
  });
});

describe('findWorkflowMatches', () => {
  const existing: RemoteWorkflow[] = [
    { collectionId: 'cards', id: '1', name: 'Triage' },
    { collectionId: 'cards', id: '2', name: 'Triage' },
    { collectionId: 'users', id: '3', name: 'Triage' },
  ];

  it('matches by explicit id first', () => {
    expect.assertions(1);

    expect(
      findWorkflowMatches(existing, { collection: 'cards', id: '3', name: 'Triage' }),
    ).toStrictEqual([existing[2]]);
  });

  it('matches by name + collection when no id is given', () => {
    expect.assertions(1);

    expect(findWorkflowMatches(existing, { collection: 'cards', name: 'Triage' })).toStrictEqual([
      existing[0],
      existing[1],
    ]);
  });

  it('returns no match for an unknown name', () => {
    expect.assertions(1);

    expect(findWorkflowMatches(existing, { collection: 'cards', name: 'Nope' })).toStrictEqual([]);
  });
});

describe('planShellUpdate', () => {
  const current: RemoteWorkflow = {
    collectionId: 'cards',
    id: '7',
    name: 'Triage',
    position: 2,
    segmentIds: ['s1'],
  };

  it('plans nothing when the spec matches the remote metadata', () => {
    expect.assertions(1);

    expect(
      planShellUpdate(current, { collection: 'cards', name: 'Triage', segments: ['s1'] }),
    ).toStrictEqual([]);
  });

  it('plans a name replace when the spec renames the workflow', () => {
    expect.assertions(1);

    const changes = planShellUpdate(current, {
      collection: 'cards',
      name: 'Triage v2',
      segments: ['s1'],
    });

    expect(changes.map(change => change.op)).toStrictEqual([
      { op: 'replace', path: '/workflows/7/name', value: 'Triage v2' },
    ]);
  });

  it('converges segments, treating an omitted `segments` as empty', () => {
    expect.assertions(1);

    const changes = planShellUpdate(current, { collection: 'cards', name: 'Triage' });

    expect(changes.map(change => change.op)).toStrictEqual([
      { op: 'replace', path: '/workflows/7/segmentIds', value: [] },
    ]);
  });

  it('only touches position when the spec pins one', () => {
    expect.assertions(2);

    expect(
      planShellUpdate(current, { collection: 'cards', name: 'Triage', segments: ['s1'] }),
    ).toStrictEqual([]);

    const changes = planShellUpdate(current, {
      collection: 'cards',
      name: 'Triage',
      position: 0,
      segments: ['s1'],
    });

    expect(changes.map(change => change.op)).toStrictEqual([
      { op: 'replace', path: '/workflows/7/position', value: 0 },
    ]);
  });

  it('labels every change for the plan display', () => {
    expect.assertions(1);

    const changes = planShellUpdate(current, {
      collection: 'cards',
      name: 'Renamed',
      position: 0,
      segments: ['s2'],
    });

    expect(changes.map(change => change.label)).toStrictEqual([
      'name: "Triage" → "Renamed"',
      'segments: [s1] → [s2]',
      'position: 2 → 0',
    ]);
  });
});
