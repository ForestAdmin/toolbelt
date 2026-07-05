import type { LayoutScope } from '../../services/layout/types';
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
import { sidecarPath } from '../../services/layout/workflow-sidecar';

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

type SidecarPlan = { bpmn: string; workflow: { collectionId: string; id: string; name: string } };
type FileWorkflow = {
  bpmnAwsS3Identifier?: string;
  collectionId: string;
  id: string;
  name?: string;
};

/**
 * Read `workflows/<id>.bpmn` sidecars for file workflows that carry no `steps`
 * (steps take precedence). Returns the upload plans plus the ids of workflows
 * that had BPMN in the file but no sidecar on disk — their BPMN cannot be
 * transported, so the caller must warn and must not patch their (source) ref.
 */
function readWorkflowSidecars(
  docs: { workflows?: unknown[] },
  filePath: string,
  stepWorkflowsList: Array<{ id: string }>,
): { missing: string[]; plans: SidecarPlan[] } {
  const stepIds = new Set(stepWorkflowsList.map(workflow => workflow.id));
  const dir = path.join(path.dirname(filePath), 'workflows');
  const plans: SidecarPlan[] = [];
  const missing: string[] = [];

  ((docs.workflows ?? []) as FileWorkflow[])
    .filter(workflow => !stepIds.has(workflow.id))
    .forEach(workflow => {
      // `sidecarPath` returns null for a traversal-unsafe id, so a crafted layout
      // file can never make apply read a file outside the workflows/ directory.
      const file = sidecarPath(dir, workflow.id);
      if (file && existsSync(file)) {
        plans.push({
          bpmn: readFileSync(file, 'utf8'),
          workflow: {
            collectionId: workflow.collectionId,
            id: workflow.id,
            name: workflow.name ?? workflow.id,
          },
        });
      } else if (workflow.bpmnAwsS3Identifier) {
        // The workflow had BPMN in the source, but its bytes weren't checked in.
        missing.push(workflow.id);
      }
    });

  return { missing, plans };
}

/**
 * Skip sidecar uploads whose bytes already match the BPMN stored in the target
 * (mirrors `planWorkflowBpmn` for step graphs) so re-applying an unchanged file
 * stays a no-op instead of minting a fresh S3 version every time.
 */
async function planSidecarUploads(
  manager: LayoutManager,
  scope: LayoutScope,
  plans: SidecarPlan[],
  remoteWorkflows: Array<Record<string, unknown>>,
  renderingId: number,
): Promise<SidecarPlan[]> {
  const decided = await Promise.all(
    plans.map(async plan => {
      const current = remoteWorkflows.find(remote => String(remote.id) === plan.workflow.id);
      const version = current?.bpmnAwsS3Identifier;
      if (typeof version !== 'string' || !version) return { changed: true, plan };

      try {
        const stored = await manager.getWorkflowBpmn(
          scope,
          plan.workflow.id,
          plan.workflow.collectionId,
          version,
          renderingId,
        );

        return { changed: stored !== plan.bpmn, plan };
      } catch (error) {
        // Auth/permission failures must surface, not be reframed as "changed".
        if (error instanceof LayoutApiError && (error.status === 401 || error.status === 403)) {
          throw error;
        }

        return { changed: true, plan };
      }
    }),
  );

  return decided.filter(entry => entry.changed).map(entry => entry.plan);
}

/**
 * When `--with-workflows`, BPMN transport is owned by the sidecar upload, not by
 * the JSON patch: `bpmnAwsS3Identifier` is a per-environment S3 pointer and is not
 * portable. Drop it from the diff so a pulled file never patches a target workflow
 * to the source env's (nonexistent) version — for workflows with a sidecar the
 * upload links the fresh id; for those without, the target keeps its own BPMN.
 */
function stripWorkflowBpmnOps<T extends { op: string; path: string; value?: unknown }>(
  ops: T[],
): T[] {
  return ops
    .filter(op => !/\/bpmnAwsS3Identifier$/.test(op.path))
    .map(op => {
      if (op.op !== 'add' || !op.value || typeof op.value !== 'object') return op;

      const value = { ...(op.value as Record<string, unknown>) };
      delete value.bpmnAwsS3Identifier;

      return { ...op, value };
    });
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
    const { docs } = parseLayoutFile(readFileSync(filePath, 'utf8'));

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
    const { missing: sidecarMissing, plans: sidecarAll } = flags['with-workflows']
      ? readWorkflowSidecars(docs, filePath, bpmnWorkflows)
      : { missing: [], plans: [] };

    const remote = await fetchRemoteDocs(manager, scope, domainsInFile(docs));
    const diff = diffAllDomains(remote, docs);
    const { warnings } = diff;
    // With --with-workflows the sidecar upload owns each workflow's BPMN pointer,
    // so the non-portable `bpmnAwsS3Identifier` must never be patched from the file.
    const ops = flags['with-workflows'] ? stripWorkflowBpmnOps(diff.ops) : diff.ops;

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

    this.logPlan({ bpmnToUpload, ops, sidecarMissing, sidecarPlans, warnings });

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
      sidecarPlans: SidecarPlan[];
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

      // Shells now exist, so upload each changed step-graph, then the sidecars.
      await uploadWorkflowBpmns(manager, scope, plan.bpmnToUpload, plan.renderingId);
      await uploadWorkflowBpmns(manager, scope, plan.sidecarPlans, plan.renderingId);

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

  /** Print the human-readable plan preview (diff + workflow uploads + missing-sidecar warning). */
  private logPlan(preview: {
    bpmnToUpload: Array<{ workflow: { name: string; steps: unknown[] } }>;
    ops: Parameters<typeof formatPlan>[0];
    sidecarMissing: string[];
    sidecarPlans: SidecarPlan[];
    warnings: Parameters<typeof formatPlan>[1];
  }): void {
    if (preview.sidecarMissing.length > 0) {
      this.logger.warn(
        `${preview.sidecarMissing.length} workflow(s) have BPMN in the file but no ` +
          `workflows/<id>.bpmn sidecar — their BPMN was not transported (the target keeps its ` +
          `own): ${preview.sidecarMissing.join(', ')}.`,
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
