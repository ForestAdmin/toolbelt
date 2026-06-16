import { matchesWhitelist } from '../../../src/services/layout/patch-rules';

describe('matchesWhitelist', () => {
  describe('layout domain', () => {
    it.each([
      ['replace', '/collections/customers/displayName'],
      ['replace', '/collections/customers/layout/columns/email/isVisible'],
      ['replace', '/collections/customers/layout/fields/email/displayName'],
      ['replace', '/collections/customers/layout/actions/refund/position'],
      ['add', '/collections/customers/layout/segments/-'],
      ['remove', '/collections/customers/layout/segments/seg-1'],
      ['replace', '/collections/customers/layout/viewEdit/summaryView'],
      ['add', '/dashboards/-'],
      ['replace', '/sections'],
    ])('accepts %s %s', (op, path) => {
      expect.assertions(1);
      expect(matchesWhitelist('layout', { op, path })).toBe(true);
    });

    it.each([
      ['remove', '/collections/customers/displayName'], // scalars are not removable
      ['replace', '/collections/customers/unknownProp'], // not whitelisted
      ['add', '/collections/customers/layout/columns/-'], // columns are not addable
      ['replace', '/collections/customers/layout/fields/email/notAProp'],
    ])('rejects %s %s', (op, path) => {
      expect.assertions(1);
      expect(matchesWhitelist('layout', { op, path })).toBe(false);
    });
  });

  describe('folders domain', () => {
    it('accepts a folder rename and rejects an unknown folder prop', () => {
      expect.assertions(2);
      expect(matchesWhitelist('folders', { op: 'replace', path: '/folders/12/name' })).toBe(true);
      expect(matchesWhitelist('folders', { op: 'replace', path: '/folders/12/color' })).toBe(false);
    });
  });
});
