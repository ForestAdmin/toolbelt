import type { PlannedOp } from '../../../src/services/layout/types';

import { LayoutApiError } from '../../../src/services/layout/errors';
import { explainApiError, formatPlan } from '../../../src/services/layout/plan-format';

const op = (over: Partial<PlannedOp>): PlannedOp => ({
  op: 'replace',
  path: '/collections/customers/displayName',
  domain: 'layout',
  label: 'layout.collections[customers].displayName',
  jsonPath: 'layout.collections[customers].displayName',
  ...over,
});

describe('explainApiError', () => {
  it('422: points to the offending JSON path when the op is found', () => {
    expect.assertions(2);
    const error = new LayoutApiError(422, "invalid: path: '/collections/customers/displayName'");

    const message = explainApiError(error, [op({})]);

    expect(message).toContain('The server rejected the patch (422)');
    expect(message).toContain('comes from: layout.collections[customers].displayName');
  });

  it('422: omits the origin hint when no sent op matches the path', () => {
    expect.assertions(1);
    const error = new LayoutApiError(422, "invalid: path: '/collections/other/icon'");

    expect(explainApiError(error, [op({})])).not.toContain('comes from:');
  });

  it('403: names the required premium pack from the offending op', () => {
    expect.assertions(1);
    const error = new LayoutApiError(403, 'Forbidden');

    const message = explainApiError(error, [op({ premiumPack: 'scopes' })]);

    expect(message).toContain('Premium feature required (pack « scopes »)');
  });

  it('403: falls back to access-denied when no op needs a premium pack', () => {
    expect.assertions(1);
    const error = new LayoutApiError(403, 'Forbidden');

    expect(explainApiError(error, [op({})])).toContain('Access denied (403)');
  });

  it('maps any other status to a generic server error', () => {
    expect.assertions(1);
    expect(explainApiError(new LayoutApiError(500, 'oops'), [])).toBe('Server error (500): oops');
  });
});

describe('formatPlan', () => {
  it('reports no changes when there is nothing to do', () => {
    expect.assertions(1);
    expect(formatPlan([], [])).toContain('No changes');
  });

  it('groups ops by domain and prints a send summary', () => {
    expect.assertions(2);
    const plan = formatPlan(
      [op({ op: 'replace', label: 'collections.customers.displayName' })],
      [],
    );

    expect(plan).toContain('layout (1 change)');
    expect(plan).toContain('1 operation to send (1 PATCH /api/layout)');
  });
});
