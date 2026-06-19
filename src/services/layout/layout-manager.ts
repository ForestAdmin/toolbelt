import type { JsonApiDocument, LayoutDomain, LayoutScope } from './types';

import Context from '@forestadmin/context';
import agent from 'superagent';

import { toLayoutApiError } from './errors';

/**
 * Read access to a rendering's layout, folders and workflows documents.
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
}
