/**
 * Resolves the patch scope (environment + team) for a project from `--env` /
 * `--team` flags (accepting either an id or a name), with smart defaults for a
 * headless run: a single candidate is taken as-is, otherwise the `development`
 * environment and the `Operations` team are preferred. When still ambiguous it
 * fails with an actionable {@link ScopeError} rather than prompting — the
 * commands are meant to run unattended (CI / onboarding).
 *
 * Pure and IO-free: the candidate lists are injected, so this is exercised in
 * tests with plain arrays and reused by the command on top of the existing
 * EnvironmentManager / TeamManager.
 */
import type { LayoutScope } from './types';

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

export type Candidate = { id: number | string; name: string; type?: string };

export type ScopeFlags = { env?: string; team?: string };

export type ScopeDeps = {
  environments: Candidate[];
  project: { id: number | string; name: string };
  serverUrl: string;
  teams: Candidate[];
};

function findByFlag(kind: string, flag: string, candidates: Candidate[]): Candidate {
  const match =
    candidates.find(candidate => String(candidate.id) === flag) ??
    candidates.find(candidate => candidate.name.toLowerCase() === flag.toLowerCase());

  if (!match) {
    const available =
      candidates.map(candidate => `${candidate.name} (#${candidate.id})`).join(', ') || 'none';
    throw new ScopeError(`${kind} "${flag}" not found. Available: ${available}.`);
  }

  return match;
}

function pick(
  kind: string,
  flagLabel: string,
  candidates: Candidate[],
  options: { defaultOf?: (list: Candidate[]) => Candidate | undefined; flag?: string },
): Candidate {
  if (options.flag) return findByFlag(kind, options.flag, candidates);

  if (candidates.length === 1) return candidates[0];

  if (candidates.length === 0)
    throw new ScopeError(`No ${kind.toLowerCase()} available on this project.`);

  const preferred = options.defaultOf?.(candidates);
  if (preferred) return preferred;

  const available = candidates.map(candidate => candidate.name).join(', ');
  throw new ScopeError(
    `Multiple ${kind.toLowerCase()}s available: specify ${flagLabel}. Available: ${available}.`,
  );
}

/** Resolve the full layout scope (ids + names) from the injected candidates and flags. */
export function resolveScope(deps: ScopeDeps, flags: ScopeFlags): LayoutScope {
  const environment = pick('Environment', '--env', deps.environments, {
    defaultOf: list =>
      list.find(candidate => candidate.type === 'development') ??
      list.find(candidate => candidate.name === 'Development'),
    flag: flags.env,
  });

  const team = pick('Team', '--team', deps.teams, {
    defaultOf: list => list.find(candidate => candidate.name === 'Operations'),
    flag: flags.team,
  });

  return {
    environmentId: Number(environment.id),
    environmentName: environment.name,
    projectId: Number(deps.project.id),
    projectName: deps.project.name,
    serverUrl: deps.serverUrl,
    teamId: Number(team.id),
    teamName: team.name,
  };
}
