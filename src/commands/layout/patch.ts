import type { LayoutDomain, PlannedOp } from '../../services/layout/types';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFile } from 'fs/promises';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import LayoutManager from '../../services/layout/layout-manager';
import { matchesWhitelist } from '../../services/layout/patch-rules';
import { explainApiError } from '../../services/layout/plan-format';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { LAYOUT_DOMAINS } from '../../services/layout/types';

/**
 * Domains this command accepts. Scoped to the layout-only domains on purpose:
 * `workflows` is deferred because creating a workflow is not a single layout
 * PATCH — it also needs a BPMN upload to S3 (use `forest layout apply` for that).
 */
const PATCH_DOMAINS: Array<Exclude<LayoutDomain, 'workflows'>> = ['layout', 'folders'];

type RawOp = { op: string; path: string; value?: unknown };
type PatchInput = Partial<Record<LayoutDomain, RawOp[]>>;

const OP_PREFIX: Record<string, string> = { add: '+', remove: '-', replace: '~' };

const STDIN_FIRST_BYTE_TIMEOUT_MS = 10_000;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let timeout: ReturnType<typeof setTimeout>;

    // Detach our listeners and release stdin on every exit path: a lingering
    // flowing-mode listener would keep the event loop alive and hang the CLI.
    const cleanup = () => {
      clearTimeout(timeout);
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');
      process.stdin.pause();
    };

    // In a spawned process with an open-but-silent stdin, `isTTY` is undefined
    // and `end` never fires (oclif's own parser defends against the same hang):
    // give the FIRST byte a deadline, then let a slow-but-real pipe stream for
    // as long as it needs.
    timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `No data received on stdin after ${STDIN_FIRST_BYTE_TIMEOUT_MS / 1000}s. ` +
            'Pass a JSON file argument, or pipe the patch via stdin.',
        ),
      );
    }, STDIN_FIRST_BYTE_TIMEOUT_MS);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      clearTimeout(timeout);
      data += chunk;
    });
    process.stdin.on('end', () => {
      cleanup();
      resolve(data);
    });
    process.stdin.on('error', error => {
      cleanup();
      reject(error);
    });
  });
}

async function readRawInput(filePath: string | undefined): Promise<string> {
  if (!filePath || filePath === '-') {
    if (process.stdin.isTTY) {
      throw new Error(
        'No input provided. Pass a JSON file or pipe the patch via stdin.\n' +
          '  Example: forest layout:patch ops.json --env Production\n' +
          '  Example: echo \'{"layout":[...]}\' | forest layout:patch --force -p 42 -e Production -t Operations',
      );
    }

    return readStdin();
  }

  return readFile(path.resolve(process.cwd(), filePath), 'utf8');
}

async function readInput(filePath: string | undefined): Promise<PatchInput> {
  const raw = await readRawInput(filePath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON: could not parse the patch input.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'Invalid patch input: expected a JSON object with domain keys (e.g. {"layout": [...], "folders": [...]}).',
    );
  }

  return parsed as PatchInput;
}

export function toPlannedOps(
  domain: Exclude<LayoutDomain, 'workflows'>,
  rawOps: RawOp[],
): PlannedOp[] {
  return rawOps.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`[${domain}][${i}]: each operation must be a JSON object.`);
    }
    if (!['add', 'replace', 'remove', 'test'].includes(raw.op)) {
      throw new Error(`[${domain}][${i}]: unknown op "${raw.op}".`);
    }
    if (typeof raw.path !== 'string' || !raw.path.startsWith('/')) {
      throw new Error(`[${domain}][${i}]: path must be a string starting with "/".`);
    }
    if (
      (raw.op === 'add' || raw.op === 'replace' || raw.op === 'test') &&
      raw.value === undefined
    ) {
      throw new Error(`[${domain}][${i}]: op "${raw.op}" requires a "value" field.`);
    }
    if (!matchesWhitelist(domain, raw)) {
      throw new Error(
        `[${domain}][${i}]: path "${raw.path}" is not allowed by the server whitelist.`,
      );
    }

    return {
      domain,
      jsonPath: raw.path,
      label: `${raw.op} ${raw.path}`,
      op: raw.op as PlannedOp['op'],
      path: raw.path,
      value: raw.value,
    };
  });
}

export function buildAllOps(input: PatchInput): PlannedOp[] {
  const unknownDomains = Object.keys(input).filter(
    key => !LAYOUT_DOMAINS.includes(key as LayoutDomain),
  );
  if (unknownDomains.length > 0) {
    throw new Error(
      `Unknown domain key${unknownDomains.length > 1 ? 's' : ''}: ${unknownDomains.join(', ')}. ` +
        `Supported domains are: ${PATCH_DOMAINS.join(', ')}.`,
    );
  }

  if (input.workflows !== undefined) {
    throw new Error(
      'The "workflows" domain is not supported by `forest layout patch`: creating a workflow ' +
        'also needs a BPMN upload, not just a layout PATCH. Use `forest layout apply` for workflows.',
    );
  }

  return PATCH_DOMAINS.flatMap(domain => {
    const rawOps = input[domain];
    if (!rawOps) return [];
    if (!Array.isArray(rawOps)) {
      throw new Error(`"${domain}" must be an array of patch operations.`);
    }

    return toPlannedOps(domain, rawOps);
  });
}

/**
 * When stdin is not an interactive terminal — the patch is piped, or the
 * command runs in CI / spawned by an agent, even with a file argument — no
 * inquirer prompt (project, environment, team, confirmation) can run: it would
 * read from a pipe and hang or crash. Non-TTY runs therefore require the full
 * scope and `--force` up front — fail fast, listing exactly what is missing.
 *
 * `FOREST_ENV_SECRET` only stands in for `-p/--projectId`: scope resolution
 * derives the project from the secret (`withCurrentProject`) but NEVER the
 * environment — without `-e/--env` it would still prompt.
 */
export function assertNonInteractiveFlags(
  flags: { env?: string; force?: boolean; projectId?: number; team?: string },
  hasEnvSecret: boolean,
): void {
  const missing: string[] = [];
  if (!flags.env) missing.push('-e/--env');
  if (!hasEnvSecret && flags.projectId === undefined) missing.push('-p/--projectId');
  if (!flags.team) missing.push('-t/--team');
  if (!flags.force) missing.push('--force');

  if (missing.length > 0) {
    throw new Error(
      'stdin is not an interactive terminal, so prompts ' +
        `(project, environment, team, confirmation) cannot run. Missing: ${missing.join(', ')}. ` +
        'Set FOREST_ENV_SECRET to omit -p/--projectId, or use --dry-run to preview without a scope.',
    );
  }
}

export function formatOps(allOps: PlannedOp[]): string {
  return PATCH_DOMAINS.flatMap(domain => {
    const domainOps = allOps.filter(op => op.domain === domain);
    if (domainOps.length === 0) return [];

    return [
      `${domain} (${domainOps.length} op${domainOps.length > 1 ? 's' : ''})`,
      ...domainOps.map(op => `  ${OP_PREFIX[op.op] ?? '·'} ${op.label}`),
    ];
  }).join('\n');
}

/**
 * `forest layout patch` — send a JSON-Patch array straight to the environment,
 * exactly like the frontend does when you tweak a collection: a single
 * `PATCH /api/:domain` per domain, no `pull`/`diff`/`apply` round-trip.
 *
 * Scope: the layout-only domains (`layout`, `folders`). `workflows` is out of
 * scope here — see {@link buildAllOps}.
 *
 * Input format (file or stdin):
 * {
 *   "layout":  [{ "op": "replace", "path": "/collections/orders/displayName", "value": "Orders" }],
 *   "folders": [{ "op": "add",     "path": "/folders/<mainId>/children/-",     "value": {...} }]
 * }
 *
 * Any non-TTY run (piped input, CI, spawned by an agent) is non-interactive by
 * construction: it requires the full scope flags and `--force` — see
 * {@link assertNonInteractiveFlags}.
 */
export default class LayoutPatchCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  private readonly inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override args = {
    file: Args.string({
      description: 'JSON patch file to apply. Use "-" or omit to read from stdin.',
      // Without this, oclif fills a missing positional FROM stdin (parser/parse.js),
      // so `echo '{...}' | forest layout patch` would readFile() the JSON as a filename.
      // Stdin must stay untouched for our own reader (multi-line JSON, explicit guard).
      ignoreStdin: true,
      required: false,
    }),
  };

  static override description =
    'Patch the layout directly (single PATCH per domain, like the front — no pull/apply).';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Print operations without sending them.',
    }),
    env: Flags.string({
      char: 'e',
      description: 'Environment name or id.',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt (required when reading from stdin).',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Project id.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team name or id.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  protected async runAuthenticated(): Promise<void> {
    const { args, flags } = await this.parse(LayoutPatchCommand);

    // No TTY on stdin ⇒ no prompt can run (scope or confirmation) — whether the
    // patch is piped or read from a file argument in CI. `--dry-run` is exempt:
    // it neither prompts nor sends.
    if (!process.stdin.isTTY && !flags['dry-run']) {
      assertNonInteractiveFlags(flags, Boolean(this.env.FOREST_ENV_SECRET));
    }

    const allOps = buildAllOps(await readInput(args.file));

    if (allOps.length === 0) {
      this.logger.success('Nothing to patch: input contains no operations.');
      return;
    }

    if (flags['dry-run']) {
      this.log(formatOps(allOps));
      this.log('\n(dry-run: nothing sent)');
      return;
    }

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    this.log(formatOps(allOps));

    if (
      !flags.force &&
      !(await this.confirm(scope.environmentName, scope.teamName, allOps.length))
    ) {
      this.logger.info('Aborted: nothing was patched.');
      return;
    }

    await this.sendPatches(new LayoutManager(), scope, allOps);

    this.logger.success(
      `Patched ${allOps.length} op${allOps.length > 1 ? 's' : ''} on ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}.`,
    );
  }

  /** One atomic PATCH per domain, in stable order. Exits 2 on a recoverable API error. */
  private async sendPatches(
    manager: LayoutManager,
    scope: Awaited<ReturnType<typeof resolveCommandScope>>,
    allOps: PlannedOp[],
  ): Promise<void> {
    const applied: LayoutDomain[] = [];

    // eslint-disable-next-line no-restricted-syntax -- sequential: one atomic PATCH per domain
    for (const domain of PATCH_DOMAINS) {
      const domainOps = allOps.filter(op => op.domain === domain);
      if (domainOps.length === 0) continue; // eslint-disable-line no-continue

      try {
        // eslint-disable-next-line no-await-in-loop -- intentional: atomic, ordered per-domain patches
        await manager.patchDomain(domain, domainOps, scope);
        applied.push(domain);
      } catch (error) {
        if (error instanceof LayoutApiError && error.status !== 401) {
          // Scope the error to this domain so path correlation in explainApiError is accurate.
          this.logger.error(explainApiError(error, domainOps));
          if (applied.length > 0) {
            // Unlike `apply`, a raw patch is NOT idempotent: replaying its "add"
            // ops would create duplicates on the domains that already succeeded.
            this.logger.warn(
              `The "${applied.join('", "')}" patch was already applied before this failure. ` +
                'Do not re-run the same input as-is: its "add" operations would be applied twice — ' +
                'remove the applied domain(s) from the input before retrying.',
            );
          }
          this.exit(2);
        }

        throw error;
      }
    }
  }

  private async confirm(
    environmentName: string,
    teamName: string,
    count: number,
  ): Promise<boolean> {
    const { confirm } = await this.inquirer.prompt([
      {
        message: `Send ${count} patch operation${
          count > 1 ? 's' : ''
        } to ${environmentName} / ${teamName}?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    return confirm;
  }
}
