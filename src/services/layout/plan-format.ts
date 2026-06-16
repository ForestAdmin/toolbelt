/** Human rendering of a diff plan, and translation of server errors. */
import type { LayoutApiError } from './errors';
import type { PlannedOp } from './types';

import { LAYOUT_DOMAINS } from './types';

const OP_PREFIX: Record<string, string> = { add: '+', remove: '-', replace: '~', test: '?' };

/** Render the plan grouped by domain, with warnings and a final count. */
export function formatPlan(ops: PlannedOp[], warnings: string[]): string {
  if (ops.length === 0 && warnings.length === 0) {
    return '✓ No changes: the remote layout already matches the file.';
  }

  const lines: string[] = [];

  LAYOUT_DOMAINS.forEach(domain => {
    const domainOps = ops.filter(op => op.domain === domain);
    if (domainOps.length === 0) return;

    lines.push(`${domain} (${domainOps.length} change${domainOps.length > 1 ? 's' : ''})`);
    domainOps.forEach(op => lines.push(`  ${OP_PREFIX[op.op] ?? '·'} ${op.label}`));
  });

  warnings.forEach(warning => lines.push(`  ⚠ ${warning}`));

  if (ops.length > 0) {
    const perDomain = LAYOUT_DOMAINS.map(domain => ({
      count: ops.filter(op => op.domain === domain).length,
      domain,
    }))
      .filter(entry => entry.count > 0)
      .map(entry => `${entry.count} PATCH /api/${entry.domain}`);
    lines.push(
      '',
      `${ops.length} operation${ops.length > 1 ? 's' : ''} to send (${perDomain.join(', ')}).`,
    );
  }

  return lines.join('\n');
}

/** Map a Forest API error to an actionable message (422 path → YAML key, 403 premium…). */
export function explainApiError(error: LayoutApiError, sentOps: PlannedOp[]): string {
  if (error.status === 422) {
    const match = error.detail.match(/path:\s*'([^']+)'/);
    const offending = match ? sentOps.find(op => op.path === match[1]) : undefined;

    const origin = offending
      ? `\n  → comes from: ${offending.yamlPath}\n  Revert this change in the file, or edit it from the UI if you know what you are doing.`
      : '';

    return `The server rejected the patch (422):\n  ${error.detail}${origin}`;
  }

  if (error.status === 403) {
    const premium = sentOps.find(op => op.premiumPack);
    if (premium) {
      return (
        `Premium feature required (pack « ${premium.premiumPack} ») for ${premium.yamlPath}.\n` +
        'Nothing was applied for this domain (atomic patch).'
      );
    }

    return 'Access denied (403): your role does not allow editing the layout of this environment.';
  }

  return `Server error (${error.status}): ${error.detail}`;
}
