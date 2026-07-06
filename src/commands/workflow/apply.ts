import type { LayoutScope } from '../../services/layout/types';
import type {
  RemoteWorkflow,
  ShellChange,
  WorkflowApplySpec,
} from '../../services/layout/workflow-apply';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import LayoutManager from '../../services/layout/layout-manager';
import { explainApiError } from '../../services/layout/plan-format';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { planWorkflowBpmn } from '../../services/layout/sync';
import {
  findWorkflowMatches,
  parseWorkflowSpec,
  planShellUpdate,
} from '../../services/layout/workflow-apply';
import { WorkflowSpecError, compileWorkflowToBpmn } from '../../services/layout/workflow-bpmn';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/** Read the spec: from the file when given, else from the (non-TTY) stdin pipe. */
async function readInput(filePath: string | undefined): Promise<string> {
  if (!filePath) return readStdin();

  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'no such file'
        : (error as Error).message;
    throw new WorkflowSpecError(`Cannot read spec file "${filePath}": ${reason}.`);
  }
}

/** What one run decided to do, resolved before anything is sent (and shown as the plan). */
type ApplyPlan = {
  bpmn: string;
  bpmnChanged: boolean;
  /** Append position for a created workflow (when the spec pins none). */
  existingCount: number;
  id: string;
  match?: RemoteWorkflow;
  renderingId: number;
  shellChanges: ShellChange[];
};

/** Add a new (BPMN-less) workflow shell to the layout. */
function addWorkflowShell(
  manager: LayoutManager,
  scope: LayoutScope,
  shell: { collection: string; id: string; name: string; position: number; segments: string[] },
): Promise<void> {
  return manager.patchDomain(
    'workflows',
    [
      {
        op: 'add',
        path: '/workflows/-',
        value: {
          collectionId: shell.collection,
          id: shell.id,
          isVisible: true,
          name: shell.name,
          position: shell.position,
          segmentIds: shell.segments,
        },
      },
    ],
    scope,
  );
}

/**
 * `forest workflow apply` — create-or-update ONE workflow from a JSON `steps`
 * spec, without touching the rest of the layout. The spec is the source of
 * truth: editing a workflow (e.g. adding a step) means editing the JSON and
 * re-applying — the whole BPMN is recompiled and re-uploaded when it differs
 * (it is atomic; there is no per-step patch), and the shell metadata (name,
 * segments, position when pinned) is converged with `replace` patches. Upsert
 * is matched by explicit `id`, else by name + collection.
 *
 * Sequence: compile steps -> BPMN; show the plan and confirm; PATCH the shell
 * (add if new, metadata replaces otherwise); upload the BPMN to the env's S3
 * (presigned) when it changed; PATCH the returned `bpmnAwsS3Identifier`.
 */
export default class WorkflowApplyCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  private readonly inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override args = {
    file: Args.string({
      description:
        'JSON workflow spec ({ name, collection, steps, id?, segments?, position?, version? }). "-" or omit to read stdin.',
      required: false,
    }),
  };

  static override description =
    'Create or update a workflow from a JSON steps spec (compiles to BPMN and uploads it). ' +
    'Reading the spec from stdin disables prompts: pass -p/-e/-t and --force explicitly.';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Resolve the scope, match the workflow and print the plan; send nothing.',
    }),
    env: Flags.string({ char: 'e', description: 'Environment name or id.' }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt (required when the spec is read from stdin).',
    }),
    projectId: Flags.integer({ char: 'p', description: 'Project id.' }),
    team: Flags.string({ char: 't', description: 'Team name or id.' }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  protected async runAuthenticated(): Promise<void> {
    const { args, flags } = await this.parse(WorkflowApplyCommand);
    const fromStdin = !args.file || args.file === '-';

    if (!this.checkStdinUsage(fromStdin, flags)) {
      this.exit(2);
      return;
    }

    let spec: WorkflowApplySpec;
    let bpmn: string;
    try {
      spec = parseWorkflowSpec(await readInput(fromStdin ? undefined : args.file));
      bpmn = compileWorkflowToBpmn(spec);
    } catch (error) {
      if (error instanceof WorkflowSpecError) {
        this.logger.error(error.message);
        this.exit(2);
        return;
      }

      throw error;
    }

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();

    try {
      const plan = await this.planApply(manager, scope, spec, bpmn);

      if (plan.match && !plan.bpmnChanged && plan.shellChanges.length === 0) {
        this.logger.success('Nothing to apply: the workflow already matches the spec.');
        return;
      }

      this.printPlan(plan, spec, scope, flags['dry-run']);

      if (flags['dry-run']) {
        this.log('\n(dry-run: nothing sent)');
        return;
      }

      if (!flags.force && !(await this.confirmOrBail(fromStdin, scope))) return;

      await this.executePlan(manager, scope, spec, plan);
      this.printOutcome(plan, spec, scope);
    } catch (error) {
      if (error instanceof LayoutApiError && error.status !== 401) {
        this.logger.error(explainApiError(error, []));
        this.exit(2);
      }

      throw error;
    }
  }

  /** M2 guards: no silent hang on a TTY, no interactive prompt when stdin carries the spec. */
  private checkStdinUsage(
    fromStdin: boolean,
    flags: { env?: string; projectId?: number; team?: string },
  ): boolean {
    if (!fromStdin) return true;

    if (process.stdin.isTTY) {
      this.logger.error(
        'Missing spec: pass a file path, or pipe JSON via stdin (e.g. `forest workflow apply spec.json`).',
      );
      return false;
    }

    if (flags.projectId === undefined || !flags.env || !flags.team) {
      this.logger.error(
        'Reading the spec from stdin disables interactive prompts: pass -p, -e and -t explicitly.',
      );
      return false;
    }

    return true;
  }

  /** Resolve everything the apply needs (match, metadata diff, BPMN diff) — read-only. */
  private async planApply(
    manager: LayoutManager,
    scope: LayoutScope,
    spec: WorkflowApplySpec,
    bpmn: string,
  ): Promise<ApplyPlan> {
    const existing = (await manager.getLayoutDomain('workflows', scope)) as RemoteWorkflow[];
    const matches = findWorkflowMatches(existing, spec);

    if (matches.length > 1) {
      this.logger.warn(
        `${matches.length} workflows named "${spec.name}" exist on collection ${spec.collection} — updating the first (id ${matches[0].id}).`,
      );
    }

    const match = matches[0];
    if (match && match.collectionId !== spec.collection) {
      throw new Error(
        `Workflow "${match.id}" is on collection "${match.collectionId}", not "${spec.collection}". ` +
          'A workflow cannot change collection — remove the `id`/rename to create a new one.',
      );
    }

    const id = match?.id ?? spec.id ?? randomUUID();
    const renderingId = await manager.getRenderingId(scope);
    // Reuses the layout-apply idempotency brick: byte-compare the compiled BPMN
    // against the stored version, so an unchanged spec uploads nothing (and a
    // re-apply is a true no-op).
    const [bpmnPlan] = match
      ? await planWorkflowBpmn(
          manager,
          scope,
          [
            {
              collectionId: spec.collection as string,
              id,
              name: spec.name as string,
              segmentIds: spec.segments,
              steps: spec.steps as unknown[],
            },
          ],
          existing as never,
          renderingId,
        )
      : [{ bpmn, changed: true }];

    return {
      bpmn: bpmnPlan.bpmn,
      bpmnChanged: bpmnPlan.changed,
      existingCount: existing.length,
      id,
      match,
      renderingId,
      shellChanges: match ? planShellUpdate(match, spec) : [],
    };
  }

  /** Say what is about to happen (or would, on --dry-run) before doing anything. */
  private printPlan(
    plan: ApplyPlan,
    spec: WorkflowApplySpec,
    scope: LayoutScope,
    dryRun: boolean,
  ): void {
    const verb = dryRun ? 'Would' : 'Will';
    const target = `${scope.environmentName} / ${scope.teamName}`;
    const stepCount = (spec.steps ?? []).length;

    if (!plan.match) {
      this.log(
        `${verb} CREATE workflow "${spec.name}" on collection ${spec.collection} (${stepCount} steps) on ${target}.`,
      );
      return;
    }

    this.log(`${verb} UPDATE workflow "${plan.match.name}" (id ${plan.match.id}) on ${target}:`);
    plan.shellChanges.forEach(change => this.log(`  ~ ${change.label}`));
    this.log(
      plan.bpmnChanged
        ? `  ~ BPMN: recompiled and replaced (${stepCount} steps) — the current BPMN and its layout edits will be overwritten`
        : '  = BPMN unchanged, upload will be skipped',
    );
  }

  /** Interactive confirmation — impossible when stdin carries the spec (require --force). */
  private async confirmOrBail(fromStdin: boolean, scope: LayoutScope): Promise<boolean> {
    if (fromStdin) {
      this.logger.error(
        'Cannot ask for confirmation when the spec is read from stdin: pass --force to apply.',
      );
      this.exit(2);
      return false;
    }

    const { confirm } = await this.inquirer.prompt([
      {
        message: `Apply this workflow to ${scope.environmentName} / ${scope.teamName}?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    if (!confirm) this.logger.info('Aborted: nothing was applied.');

    return confirm;
  }

  private async executePlan(
    manager: LayoutManager,
    scope: LayoutScope,
    spec: WorkflowApplySpec,
    plan: ApplyPlan,
  ): Promise<void> {
    if (!plan.match) {
      await addWorkflowShell(manager, scope, {
        collection: spec.collection as string,
        id: plan.id,
        name: spec.name as string,
        position: spec.position ?? plan.existingCount,
        segments: spec.segments ?? [],
      });
    } else if (plan.shellChanges.length > 0) {
      await manager.patchDomain(
        'workflows',
        plan.shellChanges.map(change => change.op),
        scope,
      );
    }

    if (plan.bpmnChanged) await this.uploadAndLinkBpmn(manager, scope, spec, plan);
  }

  /**
   * Upload the compiled BPMN and link it to the workflow. If this fails right
   * after a new shell was created, roll the shell back so no unusable,
   * BPMN-less workflow is left behind (an existing workflow is left as is —
   * its previous BPMN stays linked and re-applying converges). A failed
   * rollback is warned about, never swallowed.
   */
  private async uploadAndLinkBpmn(
    manager: LayoutManager,
    scope: LayoutScope,
    spec: WorkflowApplySpec,
    plan: ApplyPlan,
  ): Promise<void> {
    try {
      const version = await manager.uploadWorkflowBpmn(
        scope,
        plan.id,
        spec.collection as string,
        plan.renderingId,
        plan.bpmn,
      );
      await manager.patchDomain(
        'workflows',
        [{ op: 'replace', path: `/workflows/${plan.id}/bpmnAwsS3Identifier`, value: version }],
        scope,
      );
    } catch (uploadError) {
      if (!plan.match) {
        await manager
          .patchDomain('workflows', [{ op: 'remove', path: `/workflows/${plan.id}` }], scope)
          .catch(() => {
            this.logger.warn(
              `Failed to roll back workflow shell ${plan.id}: a workflow without BPMN may remain — delete it from the UI.`,
            );
          });
      }

      throw uploadError;
    }
  }

  /** Success message reflecting what actually changed. */
  private printOutcome(plan: ApplyPlan, spec: WorkflowApplySpec, scope: LayoutScope): void {
    const name = this.chalk.bold(spec.name as string);
    const target = `${this.chalk.bold(scope.environmentName)} / ${this.chalk.bold(scope.teamName)}`;
    const stepCount = (spec.steps ?? []).length;

    if (!plan.match) {
      this.logger.success(`Created workflow ${name} (${stepCount} steps) on ${target}.`);
      return;
    }

    const details = [
      ...plan.shellChanges.map(change => change.field),
      plan.bpmnChanged ? `BPMN uploaded (${stepCount} steps)` : 'BPMN unchanged, skipped',
    ];
    this.logger.success(`Updated workflow ${name} on ${target} (${details.join(', ')}).`);
  }
}
