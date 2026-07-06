/**
 * Pure logic behind `forest workflow apply`: strict parsing of the JSON spec
 * (which `forest-layout.json` deliberately does NOT get — that file is a
 * machine round-trip, this one is hand-authored), upsert matching against the
 * remote workflows document, and the metadata `replace` plan for updates.
 * Kept free of IO so it is unit-testable; the command provides the glue.
 */
import type { JsonPatchOp } from './types';
import type { WorkflowSpec } from './workflow-bpmn';

import { WorkflowSpecError } from './workflow-bpmn';

/** The hand-authored apply spec: a {@link WorkflowSpec} plus upsert extras. */
export type WorkflowApplySpec = Partial<WorkflowSpec> & {
  id?: string;
  position?: number;
  version?: number;
};

/** A workflow as returned by `GET /api/workflows/...` (patchable document). */
export type RemoteWorkflow = {
  bpmnAwsS3Identifier?: string;
  collectionId: string;
  id: string;
  name: string;
  position?: number;
  segmentIds?: string[];
};

/** One planned metadata change on an existing workflow (`replace` + display label). */
export type ShellChange = {
  field: 'name' | 'position' | 'segments';
  label: string;
  op: JsonPatchOp;
};

const TOP_LEVEL_FIELDS = [
  'collection',
  'id',
  'name',
  'position',
  'segments',
  'start',
  'steps',
  'version',
];

const STEP_FIELDS = [
  'auto',
  'autoComplete',
  'branches',
  'id',
  'inboxId',
  'mcpServerId',
  'next',
  'prompt',
  'title',
  'type',
];

const BRANCH_FIELDS = ['answer', 'color', 'next'];

/**
 * Primitive type of each whitelisted field (per level). Checked at parse time
 * so a wrongly-typed value (e.g. `mcpServerId: 123`) fails with a clean
 * `WorkflowSpecError` instead of crashing inside the BPMN compiler.
 * `steps`/`branches` (arrays of objects), `segments` (array of strings) and
 * the upsert extras `id`/`position`/`version` have dedicated checks.
 */
const TOP_LEVEL_FIELD_TYPES: Record<string, 'boolean' | 'string'> = {
  collection: 'string',
  name: 'string',
  start: 'string',
};

const STEP_FIELD_TYPES: Record<string, 'boolean' | 'string'> = {
  auto: 'boolean',
  autoComplete: 'boolean',
  id: 'string',
  inboxId: 'string',
  mcpServerId: 'string',
  next: 'string',
  prompt: 'string',
  title: 'string',
  type: 'string',
};

const BRANCH_FIELD_TYPES: Record<string, 'boolean' | 'string'> = {
  answer: 'string',
  color: 'string',
  next: 'string',
};

/** Mirrors the server patch whitelist (`patch-rules.ts` NUM_OR_UUID): a workflow id is numeric or a UUID. */
const WORKFLOW_ID_RE = /^([0-9]+|[0-9a-fA-F-]{36})$/;

/** Case-insensitive Levenshtein distance, for "did you mean" suggestions. */
function editDistance(from: string, to: string): number {
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  let previous = Array.from({ length: b.length + 1 }, (unused, j) => j);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length];
}

function unknownFieldError(key: string, validFields: string[], where: string): WorkflowSpecError {
  const [best] = validFields
    .map(candidate => ({ candidate, distance: editDistance(key, candidate) }))
    .sort((left, right) => left.distance - right.distance);

  const hint =
    best && best.distance <= 2
      ? `did you mean \`${best.candidate}\`?`
      : `valid fields: ${validFields.join(', ')}.`;

  return new WorkflowSpecError(`Unknown field "${key}"${where} — ${hint}`);
}

function assertKnownFields(
  value: Record<string, unknown>,
  validFields: string[],
  where: string,
): void {
  Object.keys(value).forEach(key => {
    if (!validFields.includes(key)) throw unknownFieldError(key, validFields, where);
  });
}

function assertFieldTypes(
  value: Record<string, unknown>,
  types: Record<string, 'boolean' | 'string'>,
  where: string,
): void {
  Object.entries(types).forEach(([key, expected]) => {
    const actual = value[key];
    if (actual !== undefined && typeof actual !== expected) {
      throw new WorkflowSpecError(
        `\`${key}\` must be a ${expected}${where} (got ${JSON.stringify(actual)}).`,
      );
    }
  });
}

function assertBranchesShape(branches: unknown, stepWhere: string): void {
  if (branches === undefined) return;

  if (!Array.isArray(branches)) {
    throw new WorkflowSpecError(
      `\`branches\` must be an array${stepWhere} (got ${JSON.stringify(branches)}).`,
    );
  }

  branches.forEach((branch, index) => {
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
      throw new WorkflowSpecError(`\`branches[${index}]\` must be a JSON object${stepWhere}.`);
    }

    assertKnownFields(branch as Record<string, unknown>, BRANCH_FIELDS, stepWhere);
    assertFieldTypes(branch as Record<string, unknown>, BRANCH_FIELD_TYPES, stepWhere);
  });
}

function assertStepsShape(steps: unknown): void {
  if (!Array.isArray(steps)) return; // validateWorkflowSpec produces the canonical error.

  steps.forEach((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new WorkflowSpecError(`\`steps[${index}]\` must be a JSON object.`);
    }

    const record = step as Record<string, unknown>;
    const stepWhere = ` in step "${record.id ?? `#${index}`}"`;
    assertKnownFields(record, STEP_FIELDS, stepWhere);
    assertFieldTypes(record, STEP_FIELD_TYPES, stepWhere);
    assertBranchesShape(record.branches, stepWhere);
  });
}

function assertTopLevelShape(spec: Record<string, unknown>): void {
  assertFieldTypes(spec, TOP_LEVEL_FIELD_TYPES, '');

  if (
    spec.segments !== undefined &&
    (!Array.isArray(spec.segments) ||
      (spec.segments as unknown[]).some(segment => typeof segment !== 'string'))
  ) {
    throw new WorkflowSpecError(
      `\`segments\` must be an array of segment ids (strings) (got ${JSON.stringify(
        spec.segments,
      )}).`,
    );
  }
}

function assertUpsertExtras(spec: WorkflowApplySpec): void {
  if (spec.version !== undefined && spec.version !== 1) {
    throw new WorkflowSpecError(
      `Unsupported spec \`version\` ${JSON.stringify(
        spec.version,
      )} — this toolbelt supports version 1 (or omit it).`,
    );
  }

  if (spec.id !== undefined && (typeof spec.id !== 'string' || !WORKFLOW_ID_RE.test(spec.id))) {
    throw new WorkflowSpecError(
      `\`id\` must be an existing workflow id — a number or a UUID (got ${JSON.stringify(
        spec.id,
      )}). Omit it to match by name + collection.`,
    );
  }

  if (
    spec.position !== undefined &&
    (typeof spec.position !== 'number' || !Number.isInteger(spec.position) || spec.position < 0)
  ) {
    throw new WorkflowSpecError(
      `\`position\` must be a non-negative integer (got ${JSON.stringify(spec.position)}).`,
    );
  }
}

/**
 * Parse the raw JSON of a `workflow apply` spec, strictly: clean JSON errors,
 * top-level/step/branch fields are whitelisted (typo-safe: "did you mean?")
 * and type-checked, `version` is absent-or-1 and `id`/`position` are
 * format-checked. Semantic
 * validation of the step graph stays in `validateWorkflowSpec` (shared with
 * the layout path, which must remain lenient about extra keys).
 */
export function parseWorkflowSpec(raw: string): WorkflowApplySpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new WorkflowSpecError(
      `Invalid JSON in spec: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WorkflowSpecError(
      'The spec must be a JSON object: { name, collection, steps, id?, segments?, position?, start?, version? }.',
    );
  }

  const spec = parsed as WorkflowApplySpec;
  assertKnownFields(parsed as Record<string, unknown>, TOP_LEVEL_FIELDS, '');
  assertTopLevelShape(parsed as Record<string, unknown>);
  assertStepsShape(spec.steps);
  assertUpsertExtras(spec);

  return spec;
}

/**
 * The workflows the spec designates, in remote order: all of them by explicit
 * `id`, else by name + collection. More than one match means the environment
 * holds duplicates — the caller warns and updates the first.
 */
export function findWorkflowMatches(
  existing: RemoteWorkflow[],
  spec: WorkflowApplySpec,
): RemoteWorkflow[] {
  if (spec.id) return existing.filter(workflow => String(workflow.id) === spec.id);

  return existing.filter(
    workflow => workflow.name === spec.name && workflow.collectionId === spec.collection,
  );
}

/**
 * The metadata `replace` ops an update needs so the spec stays the source of
 * truth: `name` and `segments` are always converged (an omitted `segments`
 * means "no segments"); `position` only when the spec pins one — the remote
 * ordering is otherwise left alone.
 */
export function planShellUpdate(current: RemoteWorkflow, spec: WorkflowApplySpec): ShellChange[] {
  const changes: ShellChange[] = [];
  const base = `/workflows/${current.id}`;

  if (spec.name !== undefined && spec.name !== current.name) {
    changes.push({
      field: 'name',
      label: `name: "${current.name}" → "${spec.name}"`,
      op: { op: 'replace', path: `${base}/name`, value: spec.name },
    });
  }

  const segments = spec.segments ?? [];
  if (JSON.stringify(segments) !== JSON.stringify(current.segmentIds ?? [])) {
    changes.push({
      field: 'segments',
      label: `segments: [${(current.segmentIds ?? []).join(', ')}] → [${segments.join(', ')}]`,
      op: { op: 'replace', path: `${base}/segmentIds`, value: segments },
    });
  }

  if (spec.position !== undefined && spec.position !== current.position) {
    changes.push({
      field: 'position',
      label: `position: ${current.position ?? '?'} → ${spec.position}`,
      op: { op: 'replace', path: `${base}/position`, value: spec.position },
    });
  }

  return changes;
}
