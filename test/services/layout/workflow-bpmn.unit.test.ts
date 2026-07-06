// bpmn-moddle only publishes an `exports` map (no `main`), invisible to the legacy node resolver.
// eslint-disable-next-line import/no-unresolved
import { BpmnModdle } from 'bpmn-moddle';

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

/** Two condition branches converging on the same target step. */
const convergingSpec = {
  collection: 'cards',
  name: 'Branchy',
  start: 'cond1',
  steps: [
    {
      branches: [
        { answer: 'Yes', next: 'done' },
        { answer: 'No', next: 'done' },
      ],
      id: 'cond1',
      type: 'condition' as const,
    },
    { id: 'done', type: 'end' as const },
  ],
};

/** One step of every supported type. */
const allTypesSpec = {
  collection: 'cards',
  name: 'Everything',
  start: 'act1',
  steps: [
    { auto: true, id: 'act1', next: 'cond1', type: 'action' as const },
    {
      branches: [
        { answer: 'Yes', next: 'esc1' },
        { answer: 'No', next: 'guide1' },
      ],
      id: 'cond1',
      type: 'condition' as const,
    },
    { id: 'esc1', inboxId: 'inbox-1', next: 'load1', type: 'escalation' as const },
    { id: 'guide1', next: 'load1', prompt: 'Check it', type: 'guidance' as const },
    { id: 'load1', next: 'mcp1', type: 'load-related' as const },
    { id: 'mcp1', mcpServerId: 'srv-1', next: 'read1', type: 'mcp' as const },
    { autoComplete: true, id: 'read1', next: 'upd1', type: 'read' as const },
    { id: 'upd1', next: 'done', type: 'update' as const },
    { id: 'done', type: 'end' as const },
  ],
};

function allXmlIds(bpmn: string): string[] {
  return [...bpmn.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
}

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

  it('declares the forest namespace and a diagram interchange section', () => {
    expect.assertions(3);
    const bpmn = compileWorkflowToBpmn(validSpec);
    expect(bpmn).toContain('xmlns:forest="https://app.forestadmin.com"');
    expect(bpmn).toContain('<bpmndi:BPMNDiagram id="BPMNDiagram_1">');
    expect(bpmn).toContain('<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">');
  });

  it('emits one BPMNShape per element and one BPMNEdge per sequence flow', () => {
    expect.assertions(4);
    const bpmn = compileWorkflowToBpmn(validSpec);
    // start event + read1 + guide1 + done
    expect(bpmn.match(/<bpmndi:BPMNShape /g)).toHaveLength(4);
    expect(bpmn).toContain('<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">');
    // start→read1, read1→guide1, guide1→done
    expect(bpmn.match(/<bpmn:sequenceFlow /g)).toHaveLength(3);
    expect(bpmn.match(/<bpmndi:BPMNEdge /g)).toHaveLength(3);
  });

  it('gives converging condition branches distinct flow ids (elements and DI edges)', () => {
    expect.assertions(4);
    const bpmn = compileWorkflowToBpmn(convergingSpec);
    expect(bpmn).toContain(
      '<bpmn:sequenceFlow id="flow_cond1_done" sourceRef="cond1" targetRef="done" name="Yes" />',
    );
    expect(bpmn).toContain(
      '<bpmn:sequenceFlow id="flow_cond1_done_2" sourceRef="cond1" targetRef="done" name="No" />',
    );
    expect(bpmn).toContain(
      '<bpmndi:BPMNEdge id="flow_cond1_done_di" bpmnElement="flow_cond1_done">',
    );
    expect(bpmn).toContain(
      '<bpmndi:BPMNEdge id="flow_cond1_done_2_di" bpmnElement="flow_cond1_done_2">',
    );
  });

  it.each([
    ['simple', validSpec],
    ['converging branches', convergingSpec],
    ['all step types', allTypesSpec],
  ])('never emits duplicate xml ids (%s)', (_label, spec) => {
    expect.assertions(1);
    const ids = allXmlIds(compileWorkflowToBpmn(spec));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('emits auto/autoComplete flags on serviceTask steps', () => {
    expect.assertions(3);
    const bpmn = compileWorkflowToBpmn(allTypesSpec);
    expect(bpmn).toContain(
      '<bpmn:serviceTask id="act1" name="act1" forest:alternative="trigger-action" forest:automaticExecution="true">',
    );
    expect(bpmn).toContain(
      '<bpmn:serviceTask id="read1" name="read1" forest:alternative="get-data" forest:automaticCompletion="true">',
    );
    // the flags never leak onto non-serviceTask elements
    const offendingLines = bpmn
      .split('\n')
      .filter(line => line.includes('forest:automatic') && !line.includes('<bpmn:serviceTask '));
    expect(offendingLines).toStrictEqual([]);
  });
});

describe('bpmn-js importability (bpmn-moddle)', () => {
  it.each([
    ['simple', validSpec],
    ['converging branches', convergingSpec],
    ['all step types', allTypesSpec],
  ])('imports the compiled BPMN without errors or warnings (%s)', async (_label, spec) => {
    expect.assertions(2);
    const moddle = new BpmnModdle();
    const { rootElement, warnings } = await moddle.fromXML(compileWorkflowToBpmn(spec));
    expect(warnings).toStrictEqual([]);
    expect(rootElement.id).toBe('Definitions_1');
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
    [
      {
        collection: 'c',
        name: 'N',
        steps: [
          { auto: true, id: 'g', next: 'e', type: 'guidance' },
          { id: 'e', type: 'end' },
        ],
      },
      '`auto`/`autoComplete` are only supported on action, load-related, mcp, read, update steps',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ autoComplete: true, id: 'e', type: 'end' }] },
      '`auto`/`autoComplete` are only supported on',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ id: 'Start_1', type: 'end' }] },
      'reserved for generated BPMN elements',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ id: 'Process_1', type: 'end' }] },
      'reserved for generated BPMN elements',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ id: 'flow_a_b', type: 'end' }] },
      'reserved for generated BPMN elements',
    ],
    [
      { collection: 'c', name: 'N', steps: [{ id: 'done_di', type: 'end' }] },
      'reserved for generated BPMN elements',
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
