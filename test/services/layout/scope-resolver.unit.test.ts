import type { Candidate } from '../../../src/services/layout/scope-resolver';

import { ScopeError, findByFlag, findBySecret } from '../../../src/services/layout/scope-resolver';

const environments: Candidate[] = [
  { id: 10, name: 'Development', secretKey: 'dev-secret', type: 'development' },
  { id: 11, name: 'Production', secretKey: 'prod-secret', type: 'production' },
];

describe('findByFlag', () => {
  it('resolves a flag given as an id', () => {
    expect.assertions(1);
    expect(findByFlag('Environment', '11', environments).name).toBe('Production');
  });

  it('resolves a flag given as a name (case-insensitive)', () => {
    expect.assertions(1);
    expect(findByFlag('Environment', 'production', environments).id).toBe(11);
  });

  it('throws an actionable ScopeError when nothing matches', () => {
    expect.assertions(2);
    expect(() => findByFlag('Environment', 'staging', environments)).toThrow(ScopeError);
    expect(() => findByFlag('Environment', 'staging', environments)).toThrow(/Available:/);
  });
});

describe('findBySecret', () => {
  it('resolves the candidate designated by the secret', () => {
    expect.assertions(1);
    expect(findBySecret('Environment', 'prod-secret', environments).name).toBe('Production');
  });

  it('ignores candidates without a secretKey', () => {
    expect.assertions(1);
    const withoutSecret: Candidate[] = [{ id: 1, name: 'No secret' }];
    expect(() => findBySecret('Environment', 'undefined', withoutSecret)).toThrow(ScopeError);
  });

  it('throws when no candidate matches the secret', () => {
    expect.assertions(1);
    expect(() => findBySecret('Environment', 'unknown', environments)).toThrow(
      /matches FOREST_ENV_SECRET/,
    );
  });
});
