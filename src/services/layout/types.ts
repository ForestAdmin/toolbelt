/** Shared types for the `forest layout` commands (pull / diff / apply). */

/** The three patchable domains served by the generic layout patch engine. */
export type LayoutDomain = 'folders' | 'layout' | 'workflows';

export const LAYOUT_DOMAINS: LayoutDomain[] = ['layout', 'folders', 'workflows'];

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

/** Parsed content of forest-layout.json (any domain may be absent on a partial pull). */
export type LayoutFileDoc = {
  folders?: unknown[];
  layout?: unknown;
  workflows?: unknown[];
};
