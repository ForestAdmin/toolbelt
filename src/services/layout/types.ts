/** Shared types for the `forest layout` commands (pull / diff / apply). */

/** The three patchable domains served by the generic layout patch engine. */
export type LayoutDomain = 'folders' | 'layout' | 'workflows';

export const LAYOUT_DOMAINS: LayoutDomain[] = ['layout', 'folders', 'workflows'];

/** A single RFC 6902 JSON-Patch operation, as accepted by `PATCH /api/:domain`. */
export type JsonPatchOp = {
  op: 'add' | 'remove' | 'replace' | 'test';
  path: string;
  value?: unknown;
};

/** A diff-produced operation, enriched for display and error mapping. */
export type PlannedOp = JsonPatchOp & {
  domain: LayoutDomain;
  /** Human label, e.g. « collections.customers.displayName : "A" → "B" ». */
  label: string;
  /** Premium pack required by this op, when any (for the 403 explanation). */
  premiumPack?: string;
  /** Where this came from in the YAML, e.g. layout.collections[customers].displayName. */
  yamlPath: string;
};

/** Minimal JSON:API resource shape (the rendering document uses snake_case attributes). */
export type JsonApiResource = {
  attributes?: Record<string, unknown>;
  id: string;
  relationships?: Record<string, { data?: unknown }>;
  type: string;
};

/** A JSON:API document with its primary resource and the flattened `included` graph. */
export type JsonApiDocument = {
  data: JsonApiResource;
  included?: JsonApiResource[];
};

/** Fully-resolved patch scope (ids + names; names are used to build the GET URL). */
export type LayoutScope = {
  environmentId: number;
  environmentName: string;
  projectId: number;
  projectName: string;
  serverUrl: string;
  teamId: number;
  teamName: string;
};

/** Parsed content of forest-layout.yml (any domain may be absent on a partial pull). */
export type LayoutFileDoc = {
  folders?: unknown[];
  layout?: unknown;
  workflows?: unknown[];
};
