/**
 * Multi-domain orchestration shared by the `layout` commands. The file may
 * carry several patchable domains (`layout`, `folders`, `workflows`); this
 * module fetches the matching remote documents and diffs each one, so a single
 * pull/diff/apply round covers everything the file declares.
 */
import type { DiffResult } from './diff';
import type LayoutManager from './layout-manager';
import type { CanonicalLayout } from './rendering-mapper';
import type { LayoutDomain, LayoutFileDoc, LayoutScope, PlannedOp } from './types';

import { v4 as uuidv4 } from 'uuid';

import { diffDomain } from './diff';
import { renderingToCanonical } from './rendering-mapper';
import { LAYOUT_DOMAINS } from './types';
import { compileWorkflowToBpmn } from './workflow-bpmn';

/** A workflow in the file that carries an authored `steps` graph (→ BPMN). */
export type StepWorkflow = {
  collectionId: string;
  id: string;
  name: string;
  segmentIds?: string[];
  steps: unknown[];
};

/** The domains a `pull` captures (the layout rebuilt from the rendering, plus folders/workflows). */
export const PULL_DOMAINS: LayoutDomain[] = LAYOUT_DOMAINS;

/** Fetch the remote patchable documents for the requested domains. */
export async function fetchRemoteDocs(
  manager: LayoutManager,
  scope: LayoutScope,
  domains: LayoutDomain[],
): Promise<LayoutFileDoc> {
  const docs: LayoutFileDoc = {};

  if (domains.includes('layout')) {
    docs.layout = renderingToCanonical(await manager.getRendering(scope));
  }

  if (domains.includes('folders')) {
    docs.folders = await manager.getLayoutDomain('folders', scope);
  }

  if (domains.includes('workflows')) {
    docs.workflows = await manager.getLayoutDomain('workflows', scope);
  }

  return docs;
}

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
      } catch {
        // Can't read the current BPMN — re-upload rather than risk a stale skip.
        return { bpmn, changed: true, workflow };
      }
    }),
  );
}

/** Count collections/workflows for a pull summary line (defensive against absent domains). */
export function summarize(docs: LayoutFileDoc): { collections: number; workflows: number } {
  const layout = docs.layout as CanonicalLayout | undefined;

  return {
    collections: layout?.collections?.length ?? 0,
    workflows: docs.workflows?.length ?? 0,
  };
}
