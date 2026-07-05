import path from 'path';

/**
 * A workflow's BPMN is stored round-trip as a sidecar file named after its id
 * (`workflows/<id>.bpmn`). Because that id comes from a layout file, a crafted
 * file could set it to `../../.ssh/id_rsa` and make `apply --with-workflows`
 * read an arbitrary file (or `pull` write outside the workflows dir). Only
 * accept ids that are a single, traversal-free path segment — Forest ids are
 * UUIDs, so this is deliberately strict.
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
