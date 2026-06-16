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

import { diffDomain } from './diff';
import { renderingToCanonical } from './rendering-mapper';
import { LAYOUT_DOMAINS } from './types';

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

/** Count collections/workflows for a pull summary line (defensive against absent domains). */
export function summarize(docs: LayoutFileDoc): { collections: number; workflows: number } {
  const layout = docs.layout as CanonicalLayout | undefined;

  return {
    collections: layout?.collections?.length ?? 0,
    workflows: docs.workflows?.length ?? 0,
  };
}
