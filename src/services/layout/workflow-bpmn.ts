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

function flowId(source: string, target: string): string {
  return `flow_${source}_${target}`;
}

/** The outgoing transitions of a step: a condition's branches, else its `next`. */
function branchesOf(step: StepSpec): BranchSpec[] {
  if (step.type === 'condition') return step.branches ?? [];

  return step.next ? [{ answer: '', next: step.next }] : [];
}

/** One `<bpmn:sequenceFlow>` (template only, no concatenation). */
function renderFlow(stepId: string, branch: BranchSpec): string {
  const nameAttr = branch.answer ? ` name="${xml(branch.answer)}"` : '';
  const colorAttr = branch.color ? ` forest:buttonColor="${xml(branch.color)}"` : '';

  return `    <bpmn:sequenceFlow id="${flowId(
    stepId,
    branch.next,
  )}" sourceRef="${stepId}" targetRef="${branch.next}"${nameAttr}${colorAttr} />`;
}

/** The `forest:*` attribute string for a step element. */
function stepAttributes(step: StepSpec): string {
  const def = STEP_TYPES[step.type];
  const attrs: string[] = [];
  if ('alternative' in def) attrs.push(`forest:alternative="${def.alternative}"`);
  if (step.auto) attrs.push('forest:automaticExecution="true"');
  if (step.autoComplete) attrs.push('forest:automaticCompletion="true"');
  if (step.prompt) attrs.push(`forest:description="${xml(step.prompt)}"`);
  if (step.type === 'mcp' && step.mcpServerId)
    attrs.push(`forest:mcpServerId="${xml(step.mcpServerId)}"`);
  if (step.type === 'escalation' && step.inboxId)
    attrs.push(`forest:inboxId="${xml(step.inboxId)}"`);

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

/** Build the BPMN element + its outgoing sequenceFlows for one step. */
function renderStep(step: StepSpec): { element: string; flows: string[] } {
  const name = xml(step.title ?? step.id);
  const branches = branchesOf(step);
  const flows = branches.map(branch => renderFlow(step.id, branch));

  if (step.type === 'end') {
    return { element: `    <bpmn:endEvent id="${step.id}" name="${name}"></bpmn:endEvent>`, flows };
  }

  const tag = STEP_TYPES[step.type].element;
  const outgoing = branches
    .map(branch => `<bpmn:outgoing>${flowId(step.id, branch.next)}</bpmn:outgoing>`)
    .join('');
  const element = `    <bpmn:${tag} id="${step.id}" name="${name}"${stepAttributes(
    step,
  )}>${outgoing}</bpmn:${tag}>`;

  return { element, flows };
}

/** Compile a workflow `steps` spec into BPMN XML (validates first). */
export function compileWorkflowToBpmn(input: Partial<WorkflowSpec>): string {
  const spec = validateWorkflowSpec(input);
  const entryId = spec.start as string;

  const elements: string[] = [
    `    <bpmn:startEvent id="Start_1"><bpmn:outgoing>${flowId(
      'Start_1',
      entryId,
    )}</bpmn:outgoing></bpmn:startEvent>`,
  ];
  const flows: string[] = [
    `    <bpmn:sequenceFlow id="${flowId(
      'Start_1',
      entryId,
    )}" sourceRef="Start_1" targetRef="${entryId}" />`,
  ];

  spec.steps.forEach(step => {
    const rendered = renderStep(step);
    elements.push(rendered.element);
    flows.push(...rendered.flows);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:forest="https://forestadmin.com">',
    '  <bpmn:process id="Process_1" isExecutable="true">',
    ...elements,
    ...flows,
    '  </bpmn:process>',
    '</bpmn:definitions>',
    '',
  ].join('\n');
}
