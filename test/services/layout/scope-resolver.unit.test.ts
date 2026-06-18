import type { ScopeDeps } from '../../../src/services/layout/scope-resolver';

import { ScopeError, resolveScope } from '../../../src/services/layout/scope-resolver';

function deps(overrides: Partial<ScopeDeps> = {}): ScopeDeps {
  return {
    environments: [
      { id: 10, name: 'Development', type: 'development' },
      { id: 11, name: 'Production', type: 'production' },
    ],
    project: { id: 7, name: 'Acme' },
    serverUrl: 'https://api.forestadmin.com',
    teams: [
      { id: 20, name: 'Operations' },
      { id: 21, name: 'Sales' },
    ],
    ...overrides,
  };
}

describe('resolveScope', () => {
  it('defaults to the development environment and the Operations team', () => {
    expect.assertions(2);
    const scope = resolveScope(deps(), {});
    expect(scope.environmentName).toBe('Development');
    expect(scope.teamName).toBe('Operations');
  });

  it('resolves a flag given as an id', () => {
    expect.assertions(2);
    const scope = resolveScope(deps(), { env: '11', team: '21' });
    expect(scope.environmentId).toBe(11);
    expect(scope.teamId).toBe(21);
  });

  it('resolves a flag given as a name (case-insensitive)', () => {
    expect.assertions(1);
    const scope = resolveScope(deps(), { env: 'production' });
    expect(scope.environmentName).toBe('Production');
  });

  it('auto-picks when a single candidate exists', () => {
    expect.assertions(1);
    const scope = resolveScope(deps({ teams: [{ id: 99, name: 'Only team' }] }), {});
    expect(scope.teamName).toBe('Only team');
  });

  it('throws when a flag matches nothing', () => {
    expect.assertions(1);
    expect(() => resolveScope(deps(), { env: 'staging' })).toThrow(ScopeError);
  });

  it('throws when ambiguous and no default applies', () => {
    expect.assertions(1);
    const ambiguous = deps({
      teams: [
        { id: 1, name: 'Red' },
        { id: 2, name: 'Blue' },
      ],
    });
    expect(() => resolveScope(ambiguous, {})).toThrow(/specify --team/);
  });

  it('returns the project ids/names from the deps', () => {
    expect.assertions(2);
    const scope = resolveScope(deps(), {});
    expect(scope.projectId).toBe(7);
    expect(scope.projectName).toBe('Acme');
  });
});
