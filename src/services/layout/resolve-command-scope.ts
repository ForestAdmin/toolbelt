/**
 * Command-side scope resolution, mirroring the other env commands. Each dimension
 * (project / environment / team) is resolved on its own:
 *
 * - **flag given** → resolve the id-or-name against the live list (verified);
 * - **FOREST_ENV_SECRET set** → the project and environment are deduced from the
 *   secret (the team still has to be picked);
 * - **nothing** → prompt the user (project via `withCurrentProject`, environment
 *   via `askForEnvironment`, team via `askForTeam`).
 *
 * Kept out of the pure layer because it performs IO.
 */
import type { Candidate } from './scope-resolver';
import type { LayoutScope } from './types';

import askForEnvironment from '../ask-for-environment';
import askForTeam from '../ask-for-team';
import EnvironmentManager from '../environment-manager';
import ProjectManager from '../project-manager';
import TeamManager from '../team-manager';
import withCurrentProject from '../with-current-project';
import { ScopeError, findByFlag } from './scope-resolver';

export type ResolveCommandScopeOptions = {
  baseEnv: Record<string, unknown> & { FOREST_SERVER_URL: string };
  flags: { env?: string; projectId?: number; team?: string };
};

/** Resolve the environment to pull: flag → interactive prompt. */
async function resolveEnvironment(
  config: { projectId: number | string } & Record<string, unknown>,
  environments: Candidate[],
  explicit?: string,
): Promise<Candidate> {
  if (explicit) return findByFlag('Environment', explicit, environments);

  const types = [...new Set(environments.map(environment => environment.type).filter(Boolean))];
  const name = await askForEnvironment(
    config,
    'Select the environment to pull the layout from',
    types,
  );

  return findByFlag('Environment', name, environments);
}

/** Resolve the team to pull: flag → interactive prompt (a secret cannot designate a team). */
async function resolveTeam(
  config: { projectId: number | string } & Record<string, unknown>,
  teams: Candidate[],
  explicit?: string,
): Promise<Candidate> {
  if (explicit) return findByFlag('Team', explicit, teams);

  const name = await askForTeam(config, 'Select the team whose layout to pull');

  return findByFlag('Team', name, teams);
}

/** Resolve the full layout scope for a command run (ids + names). */
export async function resolveCommandScope(
  options: ResolveCommandScopeOptions,
): Promise<LayoutScope> {
  const { baseEnv, flags } = options;

  const config = await withCurrentProject({
    ...baseEnv,
    projectId: flags.projectId,
  });

  const project = await new ProjectManager(config).getProject();
  if (!project) {
    throw new ScopeError(`Project #${config.projectId} not found, or you cannot access it.`);
  }

  const [environments, teams] = await Promise.all([
    new EnvironmentManager(config).listEnvironments(),
    new TeamManager(config).listForProject(),
  ]);

  const environment = await resolveEnvironment(config, environments, flags.env);
  const team = await resolveTeam(config, teams, flags.team);

  return {
    environmentId: Number(environment.id),
    environmentName: environment.name,
    projectId: Number(project.id),
    projectName: project.name,
    serverUrl: baseEnv.FOREST_SERVER_URL,
    teamId: Number(team.id),
    teamName: team.name,
  };
}
