/**
 * BPMN sidecar transport for `layout pull/apply --with-workflows`.
 *
 * A workflow's BPMN is not part of the patchable document — it lives in S3 and
 * `bpmnAwsS3Identifier` is a per-environment pointer, not portable across envs.
 * So the round-trip stores the bytes in `workflows/<id>.bpmn` files next to the
 * layout: `pull` downloads them, `apply` re-uploads them to the target and links
 * the fresh version. All the pure decision logic lives here (the commands only
 * do I/O) so it can be unit-tested.
 */
import type LayoutManager from './layout-manager';
import type { LayoutScope } from './types';

import path from 'path';

import { LayoutApiError } from './errors';

/**
 * A workflow id becomes a sidecar filename (`workflows/<id>.bpmn`). Because that
 * id comes from a layout file, a crafted file could set it to `../../.ssh/id_rsa`
 * and make `apply --with-workflows` read an arbitrary file (or `pull` write
 * outside the workflows dir). Only accept ids that are a single, traversal-free
 * path segment — Forest ids are UUIDs, so this is deliberately strict.
 */
export function isSafeWorkflowId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    !id.includes('/') &&
    !id.includes('\\') &&
    !id.includes('..') &&
    path.basename(id) === id
  );
}

/** The sidecar path for a workflow id, or null when the id is unsafe. */
export function sidecarPath(dir: string, id: unknown): string | null {
  return isSafeWorkflowId(id) ? path.join(dir, `${id}.bpmn`) : null;
}

/**
 * Resolve a file workflow to its target-env counterpart with the same
 * id-then-name matching the diff engine uses (`remoteResolver` in diff.ts), so
 * the sidecar upload targets the very workflow the domain patch addressed. A
 * dev→prod promote typically matches by NAME (each env mints its own ids).
 */
export function resolveRemoteWorkflow(
  remoteWorkflows: Array<Record<string, unknown>>,
  workflow: { id: string; name?: string },
): Record<string, unknown> | undefined {
  return (
    remoteWorkflows.find(
      remote => remote.id !== undefined && remote.id !== null && String(remote.id) === workflow.id,
    ) ??
    (typeof workflow.name === 'string'
      ? remoteWorkflows.find(remote => remote.name === workflow.name)
      : undefined)
  );
}

/**
 * When `--with-workflows`, BPMN transport is owned by the sidecar upload, not by
 * the JSON patch: `bpmnAwsS3Identifier` is a per-environment S3 pointer and is not
 * portable. Drop it from the diff so a pulled file never patches a target workflow
 * to the source env's (nonexistent) version — for workflows with a sidecar the
 * upload links the fresh id; for those without, the target keeps its own BPMN.
 */
export function stripWorkflowBpmnOps<T extends { op: string; path: string; value?: unknown }>(
  ops: T[],
): T[] {
  return ops
    .filter(op => !/\/bpmnAwsS3Identifier$/.test(op.path))
    .map(op => {
      if (op.op !== 'add' || !op.value || typeof op.value !== 'object') return op;

      const value = { ...(op.value as Record<string, unknown>) };
      delete value.bpmnAwsS3Identifier;

      return { ...op, value };
    });
}

/**
 * True when the plan would write a `bpmnAwsS3Identifier` into the target — either
 * as a replace of the pointer itself or inside an added workflow. Used by `apply`
 * WITHOUT `--with-workflows` to warn on cross-environment applies: the pointer is
 * env-local, so patching it into another env plants a dead S3 reference.
 */
export function hasWorkflowBpmnOps(
  ops: Array<{ op: string; path: string; value?: unknown }>,
): boolean {
  return ops.some(op => {
    if (/\/bpmnAwsS3Identifier$/.test(op.path)) return true;
    if (op.op !== 'add' || !op.value || typeof op.value !== 'object') return false;

    const pointer = (op.value as Record<string, unknown>).bpmnAwsS3Identifier;

    return pointer !== undefined && pointer !== null;
  });
}

/** A sidecar file read from disk, keyed by the SOURCE (layout-file) workflow. */
export type SidecarFile = {
  bpmn: string;
  workflow: { collectionId: string; id: string; name: string };
};

/** A sidecar that must be uploaded, with the TARGET-env workflow it links to. */
export type SidecarUpload = SidecarFile & {
  /**
   * The workflow to upload to in the target env (resolved id-then-name), or
   * null when the workflow does not exist there yet — it is being added by this
   * very apply, so the target must be re-resolved after the domain patch.
   */
  target: { collectionId: string; id: string } | null;
};

/**
 * Decide which sidecars need uploading, resolving each to its TARGET-env
 * workflow first (id-then-name, like the diff) so that:
 * - a same-name workflow with a different id (dev→prod promote) is uploaded
 *   under the TARGET id, never the source one;
 * - byte-identical BPMN is skipped (idempotent re-apply), including in that
 *   name-matched case.
 */
export async function planSidecarUploads(
  manager: LayoutManager,
  scope: LayoutScope,
  sidecars: SidecarFile[],
  remoteWorkflows: Array<Record<string, unknown>>,
  renderingId: number,
): Promise<SidecarUpload[]> {
  const decided = await Promise.all(
    sidecars.map(async sidecar => {
      const remote = resolveRemoteWorkflow(remoteWorkflows, sidecar.workflow);
      if (!remote) return { changed: true, upload: { ...sidecar, target: null } };

      const target = {
        collectionId: String(remote.collectionId ?? sidecar.workflow.collectionId),
        id: String(remote.id),
      };
      const upload = { ...sidecar, target };
      const version = remote.bpmnAwsS3Identifier;
      if (typeof version !== 'string' || !version) return { changed: true, upload };

      try {
        const stored = await manager.getWorkflowBpmn(
          scope,
          target.id,
          target.collectionId,
          version,
          renderingId,
        );

        return { changed: stored !== sidecar.bpmn, upload };
      } catch (error) {
        // Auth/permission failures must surface, not be reframed as "changed".
        if (error instanceof LayoutApiError && (error.status === 401 || error.status === 403)) {
          throw error;
        }

        return { changed: true, upload };
      }
    }),
  );

  return decided.filter(entry => entry.changed).map(entry => entry.upload);
}

/**
 * The sidecar filenames a pull should prune: files that LOOK like a managed
 * sidecar (`<safe-id>.bpmn`) whose id matches no workflow left in the
 * environment. Everything else is preserved:
 * - files not matching the managed pattern (a user's own BPMN files);
 * - sidecars of workflows still present in the env, even when their download
 *   was skipped (dead S3 ref) — that sidecar may be the last copy of the BPMN,
 *   and a backup tool must never destroy the backup.
 */
export function selectStaleSidecars(entries: string[], keepIds: ReadonlySet<string>): string[] {
  return entries.filter(entry => {
    const match = /^(.+)\.bpmn$/.exec(entry);

    return match !== null && isSafeWorkflowId(match[1]) && !keepIds.has(match[1]);
  });
}
