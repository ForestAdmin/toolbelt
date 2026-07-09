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

import { remoteResolver } from './diff';
import { LayoutApiError } from './errors';
import { NUM_OR_UUID } from './patch-rules';

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
 * Resolve a file workflow to its target-env counterpart by DELEGATING to the
 * diff engine's own resolver (`remoteResolver` in diff.ts), so the sidecar
 * upload targets the very workflow the domain patch addressed — including on
 * duplicate names, where the resolver's Map makes the LAST remote win. A
 * dev→prod promote typically matches by NAME (each env mints its own ids).
 */
export function resolveRemoteWorkflow(
  remoteWorkflows: Array<Record<string, unknown>>,
  workflow: { id: string; name?: string },
): Record<string, unknown> | undefined {
  return remoteResolver(remoteWorkflows)(workflow);
}

/** A file workflow that declares BPMN in the layout but has no sidecar on disk. */
export type MissingSidecar = { id: string; name: string };

/**
 * Split the missing-sidecar workflows by what actually happens to their BPMN:
 * - `targetKeepsOwn`: the workflow exists in the target env (id-then-name), so
 *   the strip of `bpmnAwsS3Identifier` leaves the target's own BPMN untouched;
 * - `createdWithoutBpmn`: the workflow matches nothing in the target — this
 *   apply `add`s it, and with its declared pointer stripped and no sidecar to
 *   upload, it is created with NO BPMN at all. The caller must warn explicitly:
 *   "keeps its own" would be a lie here.
 */
export function partitionMissingSidecars(
  missing: MissingSidecar[],
  remoteWorkflows: Array<Record<string, unknown>>,
): { createdWithoutBpmn: MissingSidecar[]; targetKeepsOwn: MissingSidecar[] } {
  const targetKeepsOwn: MissingSidecar[] = [];
  const createdWithoutBpmn: MissingSidecar[] = [];

  missing.forEach(workflow => {
    if (resolveRemoteWorkflow(remoteWorkflows, workflow)) targetKeepsOwn.push(workflow);
    else createdWithoutBpmn.push(workflow);
  });

  return { createdWithoutBpmn, targetKeepsOwn };
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
 * A managed sidecar filename: `<id>.bpmn` where the id has the shape of a REAL
 * server workflow id (numeric or UUID — the same `NUM_OR_UUID` class the patch
 * whitelist uses). Managed sidecars are the only files pull ever writes, so
 * they are the only files it may ever delete.
 */
const MANAGED_SIDECAR = new RegExp(`^${NUM_OR_UUID}\\.bpmn$`);

/**
 * The sidecar filenames a pull should prune: files named after a server
 * workflow id (`<num-or-uuid>.bpmn`) that matches no workflow left in the
 * environment. Everything else is preserved:
 * - files whose basename is not a server-shaped id (a user's own BPMN files,
 *   e.g. `review.bpmn` — pull never wrote them, so pull never deletes them);
 * - sidecars of workflows still present in the env, even when their download
 *   was skipped (dead S3 ref) — that sidecar may be the last copy of the BPMN,
 *   and a backup tool must never destroy the backup.
 */
export function selectStaleSidecars(entries: string[], keepIds: ReadonlySet<string>): string[] {
  return entries.filter(entry => {
    const match = MANAGED_SIDECAR.exec(entry);

    return match !== null && !keepIds.has(match[1]);
  });
}
