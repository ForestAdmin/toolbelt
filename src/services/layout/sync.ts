/**
 * Multi-domain orchestration shared by the `layout` commands: diff every domain
 * the file declares, and prepare the workflow `steps` graphs (compiled to BPMN,
 * uploaded out-of-band on apply). The read path lives in `read.ts`.
 */
import type { DiffResult } from './diff';
import type LayoutManager from './layout-manager';
import type { LayoutDomain, LayoutFileDoc, LayoutScope, PlannedOp } from './types';

import { v4 as uuidv4 } from 'uuid';

import { diffDomain } from './diff';
import { LayoutApiError } from './errors';
import { LAYOUT_DOMAINS } from './types';
import { compileWorkflowToBpmn } from './workflow-bpmn';

/** Domains actually present in a parsed file — we only touch what it declares. */
export function domainsInFile(local: LayoutFileDoc): LayoutDomain[] {
  return LAYOUT_DOMAINS.filter(domain => local[domain] !== undefined);
}

/** Diff every domain present in `local` against `remote`, combined into one plan. */
export function diffAllDomains(remote: LayoutFileDoc, local: LayoutFileDoc): DiffResult {
  const ops: PlannedOp[] = [];
  const warnings: string[] = [];

  domainsInFile(local).forEach(domain => {
    const result = diffDomain(domain, remote[domain], local[domain]);
    ops.push(...result.ops);
    warnings.push(...result.warnings);
  });

  return { ops, warnings };
}

/** A workflow in the file that carries an authored `steps` graph (→ BPMN). */
export type StepWorkflow = {
  collectionId: string;
  id: string;
  name: string;
  segmentIds?: string[];
  /** Entry step id — must reach the compiler, which otherwise falls back to the first step. */
  start?: string;
  steps: unknown[];
};

/**
 * Workflows in the file that carry an authored `steps` graph. Assigns a uuid id
 * to any such workflow that lacks one (mutates the doc) so the shell `add` and
 * the subsequent BPMN link target the same id.
 */
export function stepWorkflows(local: LayoutFileDoc): StepWorkflow[] {
  return ((local.workflows ?? []) as Array<Record<string, unknown>>)
    .filter(workflow => Array.isArray(workflow.steps) && (workflow.steps as unknown[]).length > 0)
    .map(workflow => {
      if (workflow.id === undefined || workflow.id === null) workflow.id = uuidv4();

      return {
        collectionId: String(workflow.collectionId),
        id: String(workflow.id),
        name: String(workflow.name),
        segmentIds: workflow.segmentIds as string[] | undefined,
        start: typeof workflow.start === 'string' ? workflow.start : undefined,
        steps: workflow.steps as unknown[],
      };
    });
}

/** A step-workflow's compiled BPMN + whether it differs from what's stored (idempotency). */
export type BpmnPlan = { bpmn: string; changed: boolean; workflow: StepWorkflow };

/**
 * Compile each step-workflow's BPMN and decide whether it needs uploading, by
 * byte-comparing against the version currently stored on the remote workflow.
 * Unchanged graphs are skipped — so re-applying a file is a true no-op (the S3
 * object is stored verbatim and the compiler is deterministic).
 */
export async function planWorkflowBpmn(
  manager: LayoutManager,
  scope: LayoutScope,
  workflows: StepWorkflow[],
  remoteWorkflows: Array<Record<string, unknown>>,
  renderingId: number,
): Promise<BpmnPlan[]> {
  return Promise.all(
    workflows.map(async workflow => {
      const bpmn = compileWorkflowToBpmn({
        collection: workflow.collectionId,
        name: workflow.name,
        segments: workflow.segmentIds,
        start: workflow.start,
        steps: workflow.steps as never,
      });

      const current = remoteWorkflows.find(remote => String(remote.id) === workflow.id);
      const version = current?.bpmnAwsS3Identifier;
      if (typeof version !== 'string' || !version) return { bpmn, changed: true, workflow };

      try {
        const stored = await manager.getWorkflowBpmn(
          scope,
          workflow.id,
          workflow.collectionId,
          version,
          renderingId,
        );

        return { bpmn, changed: stored !== bpmn, workflow };
      } catch (error) {
        // Auth/permission failures must surface, not be reframed as "changed".
        if (error instanceof LayoutApiError && (error.status === 401 || error.status === 403)) {
          throw error;
        }

        // Otherwise (no stored BPMN yet, transient read failure…) re-upload
        // rather than risk a stale skip.
        return { bpmn, changed: true, workflow };
      }
    }),
  );
}
