/**
 * Pure, IO-free matchers used to turn a `--env` / `--team` flag (accepting either
 * an id or a name) or an environment secret into a concrete candidate. The
 * candidate lists are injected, so these are exercised in tests with plain arrays
 * and reused by {@link resolveCommandScope} on top of the existing
 * EnvironmentManager / TeamManager. Selection of a default (prompting the user) is
 * deliberately NOT done here — it belongs to the IO layer.
 */
export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

export type Candidate = { id: number | string; name: string; secretKey?: string; type?: string };

/** Resolve a candidate from a flag given as an id or a (case-insensitive) name. */
export function findByFlag(kind: string, flag: string, candidates: Candidate[]): Candidate {
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

/** Resolve the candidate designated by an environment secret. */
export function findBySecret(kind: string, secret: string, candidates: Candidate[]): Candidate {
  const match = candidates.find(
    candidate => candidate.secretKey !== undefined && String(candidate.secretKey) === secret,
  );

  if (!match) {
    throw new ScopeError(
      `No ${kind.toLowerCase()} matches FOREST_ENV_SECRET. Target one explicitly with --env.`,
    );
  }

  return match;
}
