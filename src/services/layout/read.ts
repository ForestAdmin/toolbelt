/**
 * Read orchestration for `forest layout pull`: fetch the patchable documents of
 * the requested domains and rebuild the canonical layout from the rendering.
 * Kept free of the diff/apply engine so the read path stands on its own.
 */
import type LayoutManager from './layout-manager';
import type { CanonicalLayout } from './rendering-mapper';
import type { LayoutDomain, LayoutFileDoc, LayoutScope } from './types';

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

/** Count collections/workflows for a pull summary line (defensive against absent domains). */
export function summarize(docs: LayoutFileDoc): { collections: number; workflows: number } {
  const layout = docs.layout as CanonicalLayout | undefined;

  return {
    collections: layout?.collections?.length ?? 0,
    workflows: docs.workflows?.length ?? 0,
  };
}
