/**
 * Command-side scope resolution: wires the toolbelt's existing project /
 * environment / team managers into the pure {@link resolveScope}. Flags win,
 * then the forest-layout.yml header (for diff/apply), then the pure resolver's
 * defaults. Kept out of the pure layer because it performs IO.
 */
import type { LayoutScope } from './types';

import EnvironmentManager from '../environment-manager';
import ProjectManager from '../project-manager';
import TeamManager from '../team-manager';
import withCurrentProject from '../with-current-project';
import { ScopeError, resolveScope } from './scope-resolver';

export type ResolveCommandScopeOptions = {
  baseEnv: Record<string, unknown> & { FOREST_SERVER_URL: string };
  fileScope?: Partial<LayoutScope>;
  flags: { env?: string; projectId?: number; team?: string };
};

/** Resolve the full layout scope for a command run (ids + names). */
export async function resolveCommandScope(
  options: ResolveCommandScopeOptions,
): Promise<LayoutScope> {
  const { baseEnv, fileScope, flags } = options;

  const config = await withCurrentProject({
    ...baseEnv,
    projectId: flags.projectId ?? fileScope?.projectId,
  });

  const projects = await new ProjectManager(config).listProjects();
  const project = projects.find(candidate => String(candidate.id) === String(config.projectId));
  if (!project) {
    throw new ScopeError(`Project #${config.projectId} not found, or you cannot access it.`);
  }

  const [environments, teams] = await Promise.all([
    new EnvironmentManager(config).listEnvironments(),
    new TeamManager(config).listForProject(),
  ]);

  return resolveScope(
    { environments, project, serverUrl: baseEnv.FOREST_SERVER_URL, teams },
    {
      env: flags.env ?? fileScope?.environmentName,
      team: flags.team ?? fileScope?.teamName,
    },
  );
}
