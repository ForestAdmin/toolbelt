import {
  WorkflowSpecError,
  compileWorkflowToBpmn,
  validateWorkflowSpec,
} from '../../../src/services/layout/workflow-bpmn';

const validSpec = {
  collection: 'cards',
  name: 'Triage',
  steps: [
    { id: 'read1', next: 'guide1', type: 'read' as const },
    {
      id: 'guide1',
      next: 'done',
      prompt: 'Review the card',
      title: 'Review',
      type: 'guidance' as const,
    },
    { id: 'done', type: 'end' as const },
  ],
};

describe('compileWorkflowToBpmn', () => {
  it('emits a BPMN process with start, steps and sequence flows', () => {
    expect.assertions(6);
    const bpmn = compileWorkflowToBpmn(validSpec);
    expect(bpmn).toContain('<bpmn:definitions');
    expect(bpmn).toContain('<bpmn:startEvent id="Start_1">');
    expect(bpmn).toContain(
      '<bpmn:serviceTask id="read1" name="read1" forest:alternative="get-data">',
    );
    expect(bpmn).toContain('forest:description="Review the card"'); // prompt on the guidance step
    expect(bpmn).toContain('<bpmn:endEvent id="done"');
    expect(bpmn).toContain('sourceRef="Start_1" targetRef="read1"'); // entry flow
  });

  it('renders condition branches as named sequence flows', () => {
    expect.assertions(2);
    const bpmn = compileWorkflowToBpmn({
      collection: 'cards',
      name: 'Branchy',
      steps: [
        {
          branches: [
            { answer: 'Yes', next: 'done' },
            { answer: 'No', next: 'done' },
          ],
          id: 'cond1',
          type: 'condition',
        },
        { id: 'done', type: 'end' },
      ],
      start: 'cond1',
    });
    expect(bpmn).toContain('<bpmn:exclusiveGateway id="cond1"');
    expect(bpmn).toContain('name="Yes"');
  });

  it('is deterministic (same spec → byte-identical BPMN, the basis for idempotent apply)', () => {
    expect.assertions(1);
    expect(compileWorkflowToBpmn(validSpec)).toBe(compileWorkflowToBpmn(validSpec));
  });

  it('escapes XML special characters in names/prompts', () => {
    expect.assertions(1);
    const bpmn = compileWorkflowToBpmn({
      collection: 'c',
      name: 'X',
      steps: [{ id: 'e', title: 'A & B <x>', type: 'end' }],
      start: 'e',
    });
    expect(bpmn).toContain('name="A &amp; B &lt;x&gt;"');
  });
});

describe('validateWorkflowSpec', () => {
  it('defaults start to the first step and segments to []', () => {
    expect.assertions(2);
    const spec = validateWorkflowSpec(validSpec);
    expect(spec.start).toBe('read1');
    expect(spec.segments).toStrictEqual([]);
  });

  it.each([
    [{ collection: 'c', steps: [{ id: 'e', type: 'end' }] }, '`name` is required'],
    [{ name: 'N', steps: [{ id: 'e', type: 'end' }] }, '`collection` is required'],
    [{ collection: 'c', name: 'N', steps: [] }, '`steps` must be a non-empty list'],
    [
      {
        collection: 'c',
        name: 'N',
        steps: [
          { id: 'a', next: 'ghost', type: 'read' },
          { id: 'z', type: 'end' },
        ],
      },
      'unknown step "ghost"',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ id: 'a', next: 'a', type: 'read' }] },
      'at least one `end`',
    ],
  ])('rejects an invalid spec (%#)', (spec, message) => {
    expect.assertions(1);
    expect(() => validateWorkflowSpec(spec as never)).toThrow(message);
  });

  it('throws a WorkflowSpecError type', () => {
    expect.assertions(1);
    expect(() => validateWorkflowSpec({ name: 'N' } as never)).toThrow(WorkflowSpecError);
  });
});
