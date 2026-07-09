import type { LayoutScope } from '../../services/layout/types';
import type {
  MissingSidecar,
  SidecarFile,
  SidecarUpload,
} from '../../services/layout/workflow-sidecar';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import { parseLayoutFile } from '../../services/layout/layout-file';
import LayoutManager from '../../services/layout/layout-manager';
import { explainApiError, formatPlan } from '../../services/layout/plan-format';
import { fetchRemoteDocs } from '../../services/layout/read';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import {
  diffAllDomains,
  domainsInFile,
  planWorkflowBpmn,
  stepWorkflows,
} from '../../services/layout/sync';
import { LAYOUT_DOMAINS } from '../../services/layout/types';
import {
  hasWorkflowBpmnOps,
  partitionMissingSidecars,
  planSidecarUploads,
  resolveRemoteWorkflow,
  sidecarPath,
  stripWorkflowBpmnOps,
} from '../../services/layout/workflow-sidecar';

/** Upload each changed step-graph's BPMN to S3 and link the returned versions (one patch). */
async function uploadWorkflowBpmns(
  manager: LayoutManager,
  scope: LayoutScope,
  plans: Array<{ bpmn: string; workflow: { collectionId: string; id: string } }>,
  renderingId: number,
): Promise<void> {
  if (plans.length === 0) return;

  const bpmnOps = [];
  // eslint-disable-next-line no-restricted-syntax -- sequential: one S3 upload at a time
  for (const plan of plans) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential uploads
    const version = await manager.uploadWorkflowBpmn(
      scope,
      plan.workflow.id,
      plan.workflow.collectionId,
      renderingId,
      plan.bpmn,
    );
    bpmnOps.push({
      op: 'replace' as const,
      path: `/workflows/${plan.workflow.id}/bpmnAwsS3Identifier`,
      value: version,
    });
  }

  await manager.patchDomain('workflows', bpmnOps, scope);
}

type FileWorkflow = {
  bpmnAwsS3Identifier?: string;
  collectionId: string;
  id: string;
  name?: string;
};

/**
 * Read `workflows/<id>.bpmn` sidecars for file workflows that carry no `steps`
 * (steps take precedence). Only workflows that declare BPMN in the layout
 * (`bpmnAwsS3Identifier`) are considered:
 * - declared BPMN + sidecar on disk → an upload plan;
 * - declared BPMN, no sidecar → `missing`: its BPMN cannot be transported, the
 *   caller warns and never patches the (source) ref;
 * - sidecar on disk but NO declared BPMN → `orphaned`: a leftover file must not
 *   silently attach BPMN to a workflow that never had one — warn and skip.
 */
function readWorkflowSidecars(
  docs: { workflows?: unknown[] },
  filePath: string,
  stepWorkflowsList: Array<{ id: string }>,
): { missing: MissingSidecar[]; orphaned: string[]; plans: SidecarFile[] } {
  const stepIds = new Set(stepWorkflowsList.map(workflow => workflow.id));
  const dir = path.join(path.dirname(filePath), 'workflows');
  const plans: SidecarFile[] = [];
  const missing: MissingSidecar[] = [];
  const orphaned: string[] = [];

  ((docs.workflows ?? []) as FileWorkflow[])
    .filter(workflow => !stepIds.has(workflow.id))
    .forEach(workflow => {
      // `sidecarPath` returns null for a traversal-unsafe id, so a crafted layout
      // file can never make apply read a file outside the workflows/ directory.
      const file = sidecarPath(dir, workflow.id);
      const hasSidecar = file !== null && existsSync(file);

      if (!workflow.bpmnAwsS3Identifier) {
        if (hasSidecar) orphaned.push(workflow.id);
      } else if (hasSidecar) {
        plans.push({
          bpmn: readFileSync(file as string, 'utf8'),
          workflow: {
            collectionId: workflow.collectionId,
            id: workflow.id,
            name: workflow.name ?? workflow.id,
          },
        });
      } else {
        // The workflow had BPMN in the source, but its bytes weren't checked in.
        missing.push({ id: workflow.id, name: workflow.name ?? workflow.id });
      }
    });

  return { missing, orphaned, plans };
}

/**
 * `forest layout apply` — compute the JSON-Patch plan between forest-layout.json
 * and the live rendering, then PATCH it to the environment. Idempotent: an
 * unchanged file produces no operation and sends nothing.
 */
export default class LayoutApplyCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  private readonly inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override args = {
    file: Args.string({
      description: 'Layout file to apply (e.g. forest-layout.json).',
      name: 'file',
      required: true,
    }),
  };

  static override description =
    'Apply a forest-layout.json to an environment (pushes JSON-Patch changes).';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment to apply to (name or id). Prompted if omitted.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team to apply to (name or id). Prompted if omitted.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (resolved/prompted when omitted).',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt.',
    }),
    'with-workflows': Flags.boolean({
      description:
        'Also upload workflow BPMN sidecars (workflows/<id>.bpmn) to the target env — the round-trip counterpart of `pull --with-workflows`.',
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
    const { args, flags } = await this.parse(LayoutApplyCommand);

    const filePath = path.resolve(process.cwd(), args.file);
    const { docs, scope: fileScope } = parseLayoutFile(readFileSync(filePath, 'utf8'));

    // The file header is provenance only: the target env/team is chosen here
    // (flags or interactive prompt), never defaulted to where the file was pulled
    // from — otherwise re-applying onto its own environment would always be a no-op.
    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();
    // Resolve ids for workflows that carry an authored `steps` graph (mutates docs)
    // BEFORE diffing, so the shell `add` and the BPMN link target the same id.
    const bpmnWorkflows = stepWorkflows(docs);

    // Round-trip: workflows with a `workflows/<id>.bpmn` sidecar and no `steps` are
    // uploaded verbatim to the target env (faithful transport, incl. UI-authored ones).
    const {
      missing: sidecarMissing,
      orphaned: sidecarOrphaned,
      plans: sidecarAll,
    } = flags['with-workflows']
      ? readWorkflowSidecars(docs, filePath, bpmnWorkflows)
      : { missing: [], orphaned: [], plans: [] };

    const remote = await fetchRemoteDocs(manager, scope, domainsInFile(docs));
    const diff = diffAllDomains(remote, docs);
    const { warnings } = diff;
    // With --with-workflows the sidecar upload owns each workflow's BPMN pointer,
    // so the non-portable `bpmnAwsS3Identifier` must never be patched from the file.
    const ops = flags['with-workflows'] ? stripWorkflowBpmnOps(diff.ops) : diff.ops;

    this.warnOnCrossEnvBpmnRefs(flags['with-workflows'], ops, fileScope.environmentId, scope);

    // Compile each step-graph and skip the ones whose BPMN already matches what
    // is stored — so re-applying a file with `steps` (or a sidecar) stays idempotent.
    const renderingId =
      bpmnWorkflows.length > 0 || sidecarAll.length > 0 ? await manager.getRenderingId(scope) : 0;
    const remoteWorkflows = (remote.workflows ?? []) as Array<Record<string, unknown>>;
    const bpmnPlans = await planWorkflowBpmn(
      manager,
      scope,
      bpmnWorkflows,
      remoteWorkflows,
      renderingId,
    );
    const bpmnToUpload = bpmnPlans.filter(plan => plan.changed);
    const sidecarPlans = await planSidecarUploads(
      manager,
      scope,
      sidecarAll,
      remoteWorkflows,
      renderingId,
    );

    // A missing sidecar is only harmless when the target workflow already exists
    // (it keeps its own BPMN) — a workflow being ADDED by this apply would be
    // created with no BPMN at all, which deserves its own explicit warning.
    const sidecarMissingSplit = partitionMissingSidecars(sidecarMissing, remoteWorkflows);

    this.logPlan({
      bpmnToUpload,
      ops,
      sidecarMissing: sidecarMissingSplit,
      sidecarOrphaned,
      sidecarPlans,
      warnings,
    });

    if (ops.length === 0 && bpmnToUpload.length === 0 && sidecarPlans.length === 0) {
      this.logger.success('Nothing to apply: the environment already matches the file.');
      return;
    }

    if (!flags.force && !(await this.confirm(scope.environmentName, scope.teamName))) {
      this.logger.info('Aborted: nothing was applied.');
      return;
    }

    const applied = await this.pushChanges(manager, scope, {
      bpmnToUpload,
      ops,
      renderingId,
      sidecarPlans,
    });
    if (!applied) return;

    const bpmnCount = bpmnToUpload.length + sidecarPlans.length;
    const bpmnNote = bpmnCount > 0 ? ` + ${bpmnCount} workflow BPMN` : '';
    this.logger.success(
      `Applied ${ops.length} change${ops.length === 1 ? '' : 's'}${bpmnNote} to ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}.`,
    );
  }

  /**
   * Applying a file pulled from ANOTHER environment without `--with-workflows`
   * would patch its `bpmnAwsS3Identifier` pointers into the target, where the
   * S3 objects do not exist (the pointer is env-local). The ops are kept — a
   * same-env restore legitimately rewrites its own pointers, and the header may
   * be wrong or hand-edited — but the user is warned loudly beforehand.
   */
  private warnOnCrossEnvBpmnRefs(
    withWorkflows: boolean,
    ops: Array<{ op: string; path: string; value?: unknown }>,
    fileEnvironmentId: number | undefined,
    scope: LayoutScope,
  ): void {
    if (withWorkflows || !hasWorkflowBpmnOps(ops)) return;
    if (fileEnvironmentId === undefined || fileEnvironmentId === scope.environmentId) return;

    this.logger.warn(
      'This file was pulled from a different environment and the plan patches workflow BPMN ' +
        'references (`bpmnAwsS3Identifier`), which are NOT portable across environments — the ' +
        'target would point at S3 objects that do not exist there. Use `pull --with-workflows` ' +
        'then `apply --with-workflows` to transport the BPMN itself.',
    );
  }

  /**
   * Push the plan: one atomic PATCH per domain (stable order), then the step and
   * sidecar BPMN uploads. Returns false (and exits 2) on a recoverable API error;
   * re-running converges since each domain patch is atomic.
   */
  private async pushChanges(
    manager: LayoutManager,
    scope: LayoutScope,
    plan: {
      bpmnToUpload: Parameters<typeof uploadWorkflowBpmns>[2];
      ops: ReturnType<typeof diffAllDomains>['ops'];
      renderingId: number;
      sidecarPlans: SidecarUpload[];
    },
  ): Promise<boolean> {
    try {
      const domainsToPatch = LAYOUT_DOMAINS.filter(domain =>
        plan.ops.some(op => op.domain === domain),
      );
      // eslint-disable-next-line no-restricted-syntax -- sequential awaits: domains patched one at a time
      for (const domain of domainsToPatch) {
        // eslint-disable-next-line no-await-in-loop -- intentional: atomic, ordered per-domain patches
        await manager.patchDomain(
          domain,
          plan.ops.filter(op => op.domain === domain),
          scope,
        );
      }

      // Shells now exist, so upload each changed step-graph, then the sidecars —
      // each sidecar to its TARGET-env workflow id (resolved after the patches
      // for workflows this apply just added).
      await uploadWorkflowBpmns(manager, scope, plan.bpmnToUpload, plan.renderingId);
      const sidecarUploads = await this.resolveSidecarTargets(manager, scope, plan.sidecarPlans);
      await uploadWorkflowBpmns(
        manager,
        scope,
        sidecarUploads.map(upload => ({ bpmn: upload.bpmn, workflow: upload.target })),
        plan.renderingId,
      );

      return true;
    } catch (error) {
      if (error instanceof LayoutApiError && error.status !== 401) {
        this.logger.error(explainApiError(error, plan.ops));
        this.logger.warn(
          '`forest layout apply` is idempotent — some changes may already be applied; re-run it to converge.',
        );
        this.exit(2);

        return false;
      }

      throw error;
    }
  }

  /**
   * Resolve the sidecars whose target workflow did not exist before the domain
   * patches (they were `add`ed by this very apply): re-fetch the workflows
   * document once and match id-then-name. Still-unmatched sidecars are skipped
   * with a warning — never uploaded under a nonexistent id.
   */
  private async resolveSidecarTargets(
    manager: LayoutManager,
    scope: LayoutScope,
    plans: SidecarUpload[],
  ): Promise<Array<SidecarUpload & { target: { collectionId: string; id: string } }>> {
    const unresolved = plans.some(plan => plan.target === null);
    const refreshed = unresolved
      ? ((await manager.getLayoutDomain('workflows', scope)) as Array<Record<string, unknown>>)
      : [];

    return plans.flatMap(plan => {
      if (plan.target) return [{ ...plan, target: plan.target }];

      const remote = resolveRemoteWorkflow(refreshed, plan.workflow);
      if (!remote) {
        this.logger.warn(
          `Workflow « ${plan.workflow.name} » was not found in the target environment after ` +
            'the patch — its BPMN sidecar was not uploaded.',
        );

        return [];
      }

      return [
        {
          ...plan,
          target: {
            collectionId: String(remote.collectionId ?? plan.workflow.collectionId),
            id: String(remote.id),
          },
        },
      ];
    });
  }

  /** Print the human-readable plan preview (diff + workflow uploads + sidecar warnings). */
  private logPlan(preview: {
    bpmnToUpload: Array<{ workflow: { name: string; steps: unknown[] } }>;
    ops: Parameters<typeof formatPlan>[0];
    sidecarMissing: { createdWithoutBpmn: MissingSidecar[]; targetKeepsOwn: MissingSidecar[] };
    sidecarOrphaned: string[];
    sidecarPlans: SidecarUpload[];
    warnings: Parameters<typeof formatPlan>[1];
  }): void {
    const { createdWithoutBpmn, targetKeepsOwn } = preview.sidecarMissing;
    if (targetKeepsOwn.length > 0) {
      this.logger.warn(
        `${targetKeepsOwn.length} workflow(s) have BPMN in the file but no ` +
          `workflows/<id>.bpmn sidecar — their BPMN was not transported (the target keeps its ` +
          `own): ${targetKeepsOwn.map(workflow => workflow.name).join(', ')}.`,
      );
    }
    if (createdWithoutBpmn.length > 0) {
      this.logger.warn(
        `${createdWithoutBpmn.length} workflow(s) will be created WITHOUT BPMN: they declare ` +
          `BPMN in the layout file but have no workflows/<id>.bpmn sidecar and do not exist in ` +
          `the target — run \`layout pull --with-workflows\` on the source first: ` +
          `${createdWithoutBpmn.map(workflow => workflow.name).join(', ')}.`,
      );
    }
    if (preview.sidecarOrphaned.length > 0) {
      this.logger.warn(
        `${preview.sidecarOrphaned.length} sidecar file(s) match a workflow that declares no ` +
          `BPMN in the layout file — skipped (not uploaded): ${preview.sidecarOrphaned.join(
            ', ',
          )}.`,
      );
    }

    this.log(formatPlan(preview.ops, preview.warnings));
    preview.bpmnToUpload.forEach(plan =>
      this.log(
        `  ⚙ workflow « ${plan.workflow.name} »: compile + upload BPMN (${plan.workflow.steps.length} steps)`,
      ),
    );
    preview.sidecarPlans.forEach(plan =>
      this.log(`  ↑ workflow « ${plan.workflow.name} »: upload BPMN sidecar`),
    );
  }

  private async confirm(environmentName: string, teamName: string): Promise<boolean> {
    const { confirm } = await this.inquirer.prompt([
      {
        message: `Apply these changes to ${environmentName} / ${teamName}?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    return confirm;
  }
}
