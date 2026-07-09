/**
 * Compiles a declarative workflow step-graph into the BPMN XML the server's
 * workflow engine accepts. A workflow's *elements* (steps) live entirely in
 * this BPMN artifact — there is no per-element patch path; the file is uploaded
 * whole (presigned S3) and linked via `bpmnAwsS3Identifier`. This is exactly
 * what the Forest UI does (verified against a captured request trace).
 *
 * The parser reads structure + prompt + execution flags; per-field args and
 * action/MCP wiring are resolved at runtime. The spec sets the shape.
 */

/** Error in a workflow `steps` spec (authoring-time, before anything is sent). */
export class WorkflowSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSpecError';
  }
}

/** Step types → BPMN element + `forest:alternative` (task subtype). */
const STEP_TYPES = {
  action: { alternative: 'trigger-action', element: 'serviceTask' },
  condition: { element: 'exclusiveGateway' },
  end: { element: 'endEvent' },
  escalation: { element: 'intermediateThrowEvent' },
  guidance: { alternative: 'guideline', element: 'userTask' },
  'load-related': { alternative: 'load-related-record', element: 'serviceTask' },
  mcp: { alternative: 'mcp-server', element: 'serviceTask' },
  read: { alternative: 'get-data', element: 'serviceTask' },
  update: { alternative: 'update-data', element: 'serviceTask' },
} as const;

export type StepType = keyof typeof STEP_TYPES;

export type BranchSpec = { answer: string; color?: string; next: string };

export type StepSpec = {
  auto?: boolean;
  autoComplete?: boolean;
  branches?: BranchSpec[];
  id: string;
  inboxId?: string;
  mcpServerId?: string;
  next?: string;
  prompt?: string;
  title?: string;
  type: StepType;
};

export type WorkflowSpec = {
  collection: string;
  name: string;
  segments?: string[];
  start?: string;
  steps: StepSpec[];
};

const ID_RE = /^[A-Z_a-z][\w-]*$/;

/** Ids the compiler generates itself — a step id colliding with one of these
 * (or with a generated `flow_*` sequence-flow / `*_di` diagram id) would produce
 * duplicate XML ids, which bpmn-js refuses to import. */
const RESERVED_IDS = new Set([
  'Start_1',
  'Process_1',
  'Definitions_1',
  'BPMNDiagram_1',
  'BPMNPlane_1',
]);

/** The step types that compile to a `serviceTask` (the only element supporting
 * `forest:automaticExecution`/`forest:automaticCompletion`). */
const SERVICE_TASK_TYPES = Object.entries(STEP_TYPES)
  .filter(([, def]) => def.element === 'serviceTask')
  .map(([type]) => type);

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The step ids a step can transition to (branch targets for conditions, else `next`). */
function stepTargets(step: StepSpec): string[] {
  if (step.type === 'condition') return (step.branches ?? []).map(branch => branch.next);

  return step.next ? [step.next] : [];
}

function validateStepIdentity(step: StepSpec, seen: Set<string>): void {
  if (!step.id || !ID_RE.test(step.id)) {
    throw new WorkflowSpecError(
      `Each step needs an \`id\` matching ${ID_RE} (got "${step.id ?? ''}").`,
    );
  }

  if (RESERVED_IDS.has(step.id) || step.id.startsWith('flow_') || step.id.endsWith('_di')) {
    throw new WorkflowSpecError(
      `Step "${step.id}": this id is reserved for generated BPMN elements ` +
        `(${[...RESERVED_IDS].join(', ')}, \`flow_*\`, \`*_di\`).`,
    );
  }

  if (seen.has(step.id)) throw new WorkflowSpecError(`Duplicate step id "${step.id}".`);
  seen.add(step.id);

  if (!(step.type in STEP_TYPES)) {
    const supported = Object.keys(STEP_TYPES).join(', ');
    throw new WorkflowSpecError(
      `Step "${step.id}": unsupported type "${step.type}". Supported: ${supported}.`,
    );
  }
}

function validateConditionStep(step: StepSpec): void {
  if (!Array.isArray(step.branches) || step.branches.length < 2) {
    throw new WorkflowSpecError(`Condition "${step.id}" needs at least two \`branches\`.`);
  }

  step.branches.forEach(branch => {
    if (!branch.answer || !branch.next) {
      throw new WorkflowSpecError(
        `Condition "${step.id}": each branch needs \`answer\` and \`next\`.`,
      );
    }
  });
}

function validateLinkStep(step: StepSpec): void {
  if (!step.next) throw new WorkflowSpecError(`Step "${step.id}" needs a \`next\` step.`);
  if (step.type === 'mcp' && !step.mcpServerId) {
    throw new WorkflowSpecError(`Step "${step.id}" (mcp) needs \`mcpServerId\`.`);
  }

  if (step.type === 'escalation' && !step.inboxId) {
    throw new WorkflowSpecError(`Step "${step.id}" (escalation) needs \`inboxId\`.`);
  }
}

function validateStep(step: StepSpec, seen: Set<string>): void {
  validateStepIdentity(step, seen);

  if ((step.auto || step.autoComplete) && STEP_TYPES[step.type].element !== 'serviceTask') {
    throw new WorkflowSpecError(
      `Step "${step.id}": \`auto\`/\`autoComplete\` are only supported on ` +
        `${SERVICE_TASK_TYPES.join(', ')} steps.`,
    );
  }

  if (step.type === 'end') {
    if (step.next || step.branches) {
      throw new WorkflowSpecError(`Step "${step.id}" (end) must not have \`next\`/\`branches\`.`);
    }
  } else if (step.type === 'condition') {
    validateConditionStep(step);
  } else {
    validateLinkStep(step);
  }
}

/** Validate a (possibly partial) spec object and normalize it (entry step, segments). */
export function validateWorkflowSpec(spec: Partial<WorkflowSpec>): WorkflowSpec {
  if (!spec.name || typeof spec.name !== 'string')
    throw new WorkflowSpecError('`name` is required.');
  if (!spec.collection || typeof spec.collection !== 'string') {
    throw new WorkflowSpecError('`collection` is required.');
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new WorkflowSpecError('`steps` must be a non-empty list.');
  }

  const ids = new Set<string>();
  spec.steps.forEach(step => validateStep(step, ids));

  spec.steps.forEach(step => {
    stepTargets(step).forEach(target => {
      if (!ids.has(target)) {
        throw new WorkflowSpecError(`Step "${step.id}" points to unknown step "${target}".`);
      }
    });
  });

  const entry = spec.start ?? spec.steps[0].id;
  if (!ids.has(entry)) throw new WorkflowSpecError(`\`start\` "${entry}" is not a defined step.`);
  if (!spec.steps.some(step => step.type === 'end')) {
    throw new WorkflowSpecError('The workflow needs at least one `end` step.');
  }

  return {
    collection: spec.collection,
    name: spec.name,
    segments: spec.segments ?? [],
    start: entry,
    steps: spec.steps,
  };
}

/**
 * Allocate a unique, deterministic sequence-flow id. `flow_${source}_${target}`
 * alone is not unique — two condition branches can point at the same target, and
 * underscores in step ids can make distinct pairs render the same string — so
 * collisions get a stable numeric suffix (`_2`, `_3`, …) in spec order.
 */
function allocateFlowId(source: string, target: string, used: Set<string>): string {
  const base = `flow_${source}_${target}`;
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}_${n}`;
  used.add(id);

  return id;
}

/** A sequence flow with its allocated id (shared by the element, flow and DI edge). */
type FlowSpec = { branch: BranchSpec; id: string; source: string };

/** The outgoing transitions of a step: a condition's branches, else its `next`. */
function branchesOf(step: StepSpec): BranchSpec[] {
  if (step.type === 'condition') return step.branches ?? [];

  return step.next ? [{ answer: '', next: step.next }] : [];
}

/** One `<bpmn:sequenceFlow>` (template only, no concatenation). */
function renderFlow(flow: FlowSpec): string {
  const nameAttr = flow.branch.answer ? ` name="${xml(flow.branch.answer)}"` : '';
  const colorAttr = flow.branch.color ? ` forest:buttonColor="${xml(flow.branch.color)}"` : '';

  return `    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.source}" targetRef="${flow.branch.next}"${nameAttr}${colorAttr} />`;
}

/** The `forest:*` attribute string for a step element. */
function stepAttributes(step: StepSpec): string {
  const def = STEP_TYPES[step.type];
  const attrs: string[] = [];
  if ('alternative' in def) attrs.push(`forest:alternative="${def.alternative}"`);
  // `automaticExecution`/`automaticCompletion` are only meaningful on serviceTask
  // steps — a `guidance` step is a manual userTask the UI cannot auto-complete, so
  // emitting the flag there produces BPMN the editor can't round-trip.
  if (def.element === 'serviceTask') {
    if (step.auto) attrs.push('forest:automaticExecution="true"');
    if (step.autoComplete) attrs.push('forest:automaticCompletion="true"');
  }
  if (step.prompt) attrs.push(`forest:description="${xml(step.prompt)}"`);
  if (step.type === 'mcp' && step.mcpServerId)
    attrs.push(`forest:mcpServerId="${xml(step.mcpServerId)}"`);
  if (step.type === 'escalation' && step.inboxId)
    attrs.push(`forest:inboxId="${xml(step.inboxId)}"`);

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

/** Build the BPMN element + its outgoing sequenceFlows for one step. */
function renderStep(step: StepSpec, flowSpecs: FlowSpec[]): { element: string; flows: string[] } {
  const name = xml(step.title ?? step.id);
  const flows = flowSpecs.map(flow => renderFlow(flow));

  if (step.type === 'end') {
    return { element: `    <bpmn:endEvent id="${step.id}" name="${name}"></bpmn:endEvent>`, flows };
  }

  const tag = STEP_TYPES[step.type].element;
  const outgoing = flowSpecs.map(flow => `<bpmn:outgoing>${flow.id}</bpmn:outgoing>`).join('');
  const element = `    <bpmn:${tag} id="${step.id}" name="${name}"${stepAttributes(
    step,
  )}>${outgoing}</bpmn:${tag}>`;

  return { element, flows };
}

type DiagramNode = { id: string; tag: string };
type DiagramEdge = { id: string; source: string; target: string };
type Bounds = { h: number; w: number; x: number; y: number };

/** BPMN element footprint by shape kind (events / gateways / tasks). */
function elementSize(tag: string): { h: number; w: number } {
  if (tag.endsWith('Event')) return { h: 36, w: 36 };
  if (tag === 'exclusiveGateway') return { h: 50, w: 50 };

  return { h: 80, w: 100 };
}

/**
 * A minimal left-to-right BPMN-DI diagram. bpmn-js (the workflow editor) refuses
 * to import a `definitions` with no `<bpmndi:BPMNDiagram>` ("Import BPMN Error"),
 * so every element needs a shape and every sequence flow an edge — a naive layout
 * the user can rearrange is enough to make the workflow editable.
 */
function renderDiagram(nodes: DiagramNode[], edges: DiagramEdge[]): string[] {
  const laneCenter = 160;
  const gap = 60;
  let cursor = 160;
  const bounds: Record<string, Bounds> = {};
  nodes.forEach(node => {
    const { h, w } = elementSize(node.tag);
    bounds[node.id] = { h, w, x: cursor, y: laneCenter - h / 2 };
    cursor += w + gap;
  });

  const shapes = nodes
    .map(node => {
      const b = bounds[node.id];
      if (!b) return '';

      return `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}"><dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" /></bpmndi:BPMNShape>`;
    })
    .filter(Boolean);

  const flowEdges = edges
    .map(edge => {
      const from = bounds[edge.source];
      const to = bounds[edge.target];
      if (!from || !to) return '';
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;

      return `      <bpmndi:BPMNEdge id="${edge.id}_di" bpmnElement="${edge.id}"><di:waypoint x="${x1}" y="${y1}" /><di:waypoint x="${x2}" y="${y2}" /></bpmndi:BPMNEdge>`;
    })
    .filter(Boolean);

  return [
    '  <bpmndi:BPMNDiagram id="BPMNDiagram_1">',
    '    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">',
    ...shapes,
    ...flowEdges,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
  ];
}

/** Compile a workflow `steps` spec into BPMN XML (validates first). */
export function compileWorkflowToBpmn(input: Partial<WorkflowSpec>): string {
  const spec = validateWorkflowSpec(input);
  const entryId = spec.start as string;

  const usedFlowIds = new Set<string>();
  const entryFlowId = allocateFlowId('Start_1', entryId, usedFlowIds);

  const nodes: DiagramNode[] = [{ id: 'Start_1', tag: 'startEvent' }];
  const edges: DiagramEdge[] = [{ id: entryFlowId, source: 'Start_1', target: entryId }];
  const elements: string[] = [
    `    <bpmn:startEvent id="Start_1"><bpmn:outgoing>${entryFlowId}</bpmn:outgoing></bpmn:startEvent>`,
  ];
  const flows: string[] = [
    `    <bpmn:sequenceFlow id="${entryFlowId}" sourceRef="Start_1" targetRef="${entryId}" />`,
  ];

  spec.steps.forEach(step => {
    const flowSpecs: FlowSpec[] = branchesOf(step).map(branch => ({
      branch,
      id: allocateFlowId(step.id, branch.next, usedFlowIds),
      source: step.id,
    }));
    const rendered = renderStep(step, flowSpecs);
    elements.push(rendered.element);
    flows.push(...rendered.flows);
    nodes.push({ id: step.id, tag: STEP_TYPES[step.type].element });
    flowSpecs.forEach(flow => {
      edges.push({ id: flow.id, source: step.id, target: flow.branch.next });
    });
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:forest="https://app.forestadmin.com" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">',
    '  <bpmn:process id="Process_1" isExecutable="true">',
    ...elements,
    ...flows,
    '  </bpmn:process>',
    ...renderDiagram(nodes, edges),
    '</bpmn:definitions>',
    '',
  ].join('\n');
}
