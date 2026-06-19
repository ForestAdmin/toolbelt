/**
 * (De)serialization of forest-layout.json: a `forest` header carrying the scope,
 * then one section per domain mirroring the patchable documents 1:1. JSON is used
 * for consistency with the rest of the toolbelt (`.forestadmin-schema.json`) and
 * the JSON:API server — the file is a machine round-trip (pull → diff → apply),
 * not a hand-commented document.
 */
import type { LayoutFileDoc, LayoutScope } from './types';

export class LayoutFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutFileError';
  }
}

/** Serialize the pulled documents with the scope header. */
export function serializeLayoutFile(
  scope: LayoutScope,
  docs: LayoutFileDoc,
  now: () => Date,
): string {
  const content = {
    forest: {
      environment: { id: scope.environmentId, name: scope.environmentName },
      project: { id: scope.projectId, name: scope.projectName },
      pulledAt: now().toISOString(),
      server: scope.serverUrl,
      team: { id: scope.teamId, name: scope.teamName },
      version: 1,
    },
    ...(docs.layout === undefined ? {} : { layout: docs.layout }),
    ...(docs.folders === undefined ? {} : { folders: docs.folders }),
    ...(docs.workflows === undefined ? {} : { workflows: docs.workflows }),
  };

  return `${JSON.stringify(content, null, 2)}\n`;
}

/** Parse the file back; tolerates absent domains (partial pulls). */
export function parseLayoutFile(content: string): {
  docs: LayoutFileDoc;
  scope: Partial<LayoutScope>;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new LayoutFileError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new LayoutFileError('Empty or invalid layout file.');
  }

  const root = parsed as Record<string, unknown>;
  const header = root.forest as
    | {
        environment?: { id?: number; name?: string };
        project?: { id?: number; name?: string };
        server?: string;
        team?: { id?: number; name?: string };
      }
    | undefined;

  if (!header) {
    throw new LayoutFileError(
      'Missing `forest` header. Generate the file with `forest layout pull`.',
    );
  }

  const scope: Partial<LayoutScope> = {
    environmentId: header.environment?.id,
    environmentName: header.environment?.name,
    projectId: header.project?.id,
    projectName: header.project?.name,
    serverUrl: header.server,
    teamId: header.team?.id,
    teamName: header.team?.name,
  };

  return {
    docs: {
      folders: root.folders as undefined | unknown[],
      layout: root.layout,
      workflows: root.workflows as undefined | unknown[],
    },
    scope,
  };
}
