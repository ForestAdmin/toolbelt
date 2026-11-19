import type { LayoutDomain } from './types';

import { LAYOUT_DOMAINS } from './types';

export function failedPartLine(part: LayoutDomain): string {
  return `Failed part: ${part}`;
}

export function readFailedPart(output: string): LayoutDomain | undefined {
  return LAYOUT_DOMAINS.find(part => output.includes(failedPartLine(part)));
}
