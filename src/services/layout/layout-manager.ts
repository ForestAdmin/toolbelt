import type { JsonApiDocument, JsonPatchOp, LayoutDomain, LayoutScope } from './types';

import Context from '@forestadmin/context';
import agent from 'superagent';

import { toLayoutApiError } from './errors';

/**
 * Read/write access to a rendering's layout, folders and workflows documents.
 *
 * The "layout" is the server-side rendering. There is no raw GET for the
 * layout domain (GET /api/layout returns []); the source of truth is the
 * JSON:API rendering document, read by name through
 * `GET /api/renderings/:project/:env/:team` — the same route the frontend uses.
 *
 * This adapter intentionally returns the raw response body (snake_case
 * attributes, `included` graph) so the rendering mapper can invert the
 * serialization itself. It reuses the toolbelt authenticator/env exactly like
 * the other managers (TeamManager, EnvironmentManager) — no auth is
 * re-implemented here. Later milestones (diff/apply) add the
 * `PATCH /api/:domain` write path on top of the same headers.
 */
export default class LayoutManager {
  private readonly authenticator: { getAuthToken(): string };

  private readonly serverUrl: string;

  constructor() {
    const { assertPresent, authenticator, env } = Context.inject() as {
      assertPresent: (dependencies: Record<string, unknown>) => void;
      authenticator: { getAuthToken(): string };
      env: { FOREST_SERVER_URL: string };
    };
    assertPresent({ authenticator, env });

    this.authenticator = authenticator;
    this.serverUrl = env.FOREST_SERVER_URL;
  }

  /** GET /api/renderings/:project/:env/:team — the rendering as JSON:API. */
  async getRendering(scope: LayoutScope): Promise<JsonApiDocument> {
    const path = [scope.projectName, scope.environmentName, scope.teamName]
      .map(segment => encodeURIComponent(segment))
      .join('/');

    try {
      const response = await agent
        .get(`${this.serverUrl}/api/renderings/${path}`)
        .set('Authorization', `Bearer ${this.authenticator.getAuthToken()}`)
        .set('forest-project-id', String(scope.projectId))
        .set('forest-environment-id', String(scope.environmentId))
        .set('forest-team-id', String(scope.teamId))
        .send();

      return response.body as JsonApiDocument;
    } catch (error) {
      throw toLayoutApiError(error);
    }
  }

  /**
   * GET /api/:domain/:project/:env/:team — the raw patchable document for a
   * non-layout domain (folders, workflows). The layout domain has no usable raw
   * GET (it returns []), so use {@link getRendering} for it instead.
   */
  async getLayoutDomain(
    domain: Exclude<LayoutDomain, 'layout'>,
    scope: LayoutScope,
  ): Promise<unknown[]> {
    const path = [domain, scope.projectName, scope.environmentName, scope.teamName]
      .map(segment => encodeURIComponent(segment))
      .join('/');

    try {
      const response = await agent
        .get(`${this.serverUrl}/api/${path}`)
        .set('Authorization', `Bearer ${this.authenticator.getAuthToken()}`)
        .set('forest-project-id', String(scope.projectId))
        .set('forest-environment-id', String(scope.environmentId))
        .set('forest-team-id', String(scope.teamId))
        .send();

      return (response.body ?? []) as unknown[];
    } catch (error) {
      throw toLayoutApiError(error);
    }
  }

  /**
   * PATCH /api/:domain — apply an RFC 6902 JSON-Patch array, scoped by the
   * environment/team headers. The patch is atomic server-side; a 204 is
   * expected on success. Only `op`/`path`/`value` are sent (planner metadata
   * is dropped). A no-op array is skipped entirely.
   */
  async patchDomain(domain: LayoutDomain, ops: JsonPatchOp[], scope: LayoutScope): Promise<void> {
    if (ops.length === 0) return;

    const body = ops.map(({ op, path, value }) =>
      value === undefined ? { op, path } : { op, path, value },
    );

    try {
      await agent
        .patch(`${this.serverUrl}/api/${domain}`)
        .set('Authorization', `Bearer ${this.authenticator.getAuthToken()}`)
        .set('forest-project-id', String(scope.projectId))
        .set('forest-environment-id', String(scope.environmentId))
        .set('forest-team-id', String(scope.teamId))
        .send(body);
    } catch (error) {
      throw toLayoutApiError(error);
    }
  }

  /** The numeric rendering id for this scope (needed by the workflow presigned request). */
  async getRenderingId(scope: LayoutScope): Promise<number> {
    const rendering = await this.getRendering(scope);

    return Number(rendering.data.id);
  }

  /**
   * Download the currently-stored BPMN of a workflow version, to diff against a
   * freshly compiled one (idempotency). The server returns a presigned S3 GET
   * URL; the bytes are then fetched straight from S3 (no Forest auth there).
   */
  async getWorkflowBpmn(
    scope: LayoutScope,
    workflowId: string,
    collectionId: string,
    version: string,
    renderingId: number,
  ): Promise<string> {
    try {
      const meta = await agent
        .get(`${this.serverUrl}/api/workflows/${workflowId}/bpmn`)
        .query({ collectionId, version })
        .set('Authorization', `Bearer ${this.authenticator.getAuthToken()}`)
        .set('forest-project-id', String(scope.projectId))
        .set('forest-environment-id', String(scope.environmentId))
        .set('forest-team-id', String(scope.teamId))
        .set('forest-rendering-id', String(renderingId));

      const { signedUrl } = meta.body as { signedUrl?: string };
      if (!signedUrl) return '';

      const file = await agent.get(signedUrl).buffer(true);

      return file.text ?? '';
    } catch (error) {
      throw toLayoutApiError(error);
    }
  }

  /**
   * Upload a workflow's compiled BPMN and return its S3 version id (to store in
   * `bpmnAwsS3Identifier`). Mirrors the Forest UI exactly: ask the server for a
   * presigned S3 POST, multipart-upload the BPMN to S3, read `x-amz-version-id`.
   */
  async uploadWorkflowBpmn(
    scope: LayoutScope,
    workflowId: string,
    collectionId: string,
    renderingId: number,
    bpmn: string,
  ): Promise<string> {
    const size = Buffer.byteLength(bpmn);

    let presigned: { fields: Record<string, string>; url: string };
    try {
      const response = await agent
        .post(`${this.serverUrl}/api/workflows/${workflowId}/generate-presigned-request`)
        .query({ collectionId })
        .set('Authorization', `Bearer ${this.authenticator.getAuthToken()}`)
        .set('forest-project-id', String(scope.projectId))
        .set('forest-environment-id', String(scope.environmentId))
        .set('forest-team-id', String(scope.teamId))
        .set('forest-rendering-id', String(renderingId))
        .send({ name: `${workflowId}.bpmn`, size, type: 'text/xml' });
      presigned = response.body as { fields: Record<string, string>; url: string };
    } catch (error) {
      throw toLayoutApiError(error);
    }

    // Presigned S3 POST: send the returned policy fields, then the file last. No
    // Forest auth here — the presigned signature authorizes the upload.
    let response;
    try {
      const upload = agent.post(presigned.url);
      Object.entries(presigned.fields).forEach(([key, value]) => upload.field(key, value));
      response = await upload.attach('file', Buffer.from(bpmn), {
        contentType: 'text/xml',
        filename: `${workflowId}.bpmn`,
      });
    } catch (error) {
      throw toLayoutApiError(error);
    }

    const versionId = response.headers['x-amz-version-id'];
    if (!versionId) {
      throw new Error(
        'S3 did not return a version id for the uploaded BPMN (bucket versioning off?).',
      );
    }

    return versionId;
  }
}
