import type { LayoutScope } from '../../services/layout/types';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
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
import { parseLayoutFile } from '../../services/layout/yaml-file';

const DEFAULT_FILE = 'forest-layout.yml';

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

/**
 * `forest layout apply` — compute the JSON-Patch plan between forest-layout.yml
 * and the live rendering, then PATCH it to the environment. Idempotent: an
 * unchanged file produces no operation and sends nothing.
 */
export default class LayoutApplyCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  private readonly inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override args = {
    file: Args.string({
      default: DEFAULT_FILE,
      description: `Layout file to apply (default: ${DEFAULT_FILE}).`,
      name: 'file',
    }),
  };

  static override description =
    'Apply a forest-layout.yml to an environment (pushes JSON-Patch changes).';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment to apply to (name or id). Defaults to the file header.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team to apply to (name or id). Defaults to the file header.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (defaults to the file header).',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt.',
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

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      fileScope,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();
    // Resolve ids for workflows that carry an authored `steps` graph (mutates docs)
    // BEFORE diffing, so the shell `add` and the BPMN link target the same id.
    const bpmnWorkflows = stepWorkflows(docs);

    const remote = await fetchRemoteDocs(manager, scope, domainsInFile(docs));
    const { ops, warnings } = diffAllDomains(remote, docs);

    // Compile each step-graph and skip the ones whose BPMN already matches what
    // is stored — so re-applying a file with `steps` stays idempotent.
    const renderingId = bpmnWorkflows.length > 0 ? await manager.getRenderingId(scope) : 0;
    const remoteWorkflows = (remote.workflows ?? []) as Array<Record<string, unknown>>;
    const bpmnPlans = await planWorkflowBpmn(
      manager,
      scope,
      bpmnWorkflows,
      remoteWorkflows,
      renderingId,
    );
    const bpmnToUpload = bpmnPlans.filter(plan => plan.changed);

    this.log(formatPlan(ops, warnings));
    bpmnToUpload.forEach(plan =>
      this.log(
        `  ⚙ workflow « ${plan.workflow.name} »: compile + upload BPMN (${plan.workflow.steps.length} steps)`,
      ),
    );

    if (ops.length === 0 && bpmnToUpload.length === 0) {
      this.logger.success('Nothing to apply: the environment already matches the file.');
      return;
    }

    if (!flags.force && !(await this.confirm(scope.environmentName, scope.teamName))) {
      this.logger.info('Aborted: nothing was applied.');
      return;
    }

    try {
      // One atomic PATCH per domain, in a stable order; ops are already add→replace→remove.
      const domainsToPatch = LAYOUT_DOMAINS.filter(domain => ops.some(op => op.domain === domain));
      // eslint-disable-next-line no-restricted-syntax -- sequential awaits: domains patched one at a time
      for (const domain of domainsToPatch) {
        // eslint-disable-next-line no-await-in-loop -- intentional: atomic, ordered per-domain patches
        await manager.patchDomain(
          domain,
          ops.filter(op => op.domain === domain),
          scope,
        );
      }

      // BPMN authoring: shells now exist, so upload each changed step-graph and
      // link the returned versions (one patch).
      await uploadWorkflowBpmns(manager, scope, bpmnToUpload, renderingId);
    } catch (error) {
      if (error instanceof LayoutApiError && error.status !== 401) {
        this.logger.error(explainApiError(error, ops));
        // Patches are atomic per domain, not across the whole apply: earlier domains
        // (or BPMN uploads) may already be committed. Re-running converges safely.
        this.logger.warn(
          '`forest layout apply` is idempotent — some changes may already be applied; re-run it to converge.',
        );
        this.exit(2);
        return;
      }

      throw error;
    }

    const bpmnNote = bpmnToUpload.length > 0 ? ` + ${bpmnToUpload.length} workflow BPMN` : '';
    this.logger.success(
      `Applied ${ops.length} change${ops.length === 1 ? '' : 's'}${bpmnNote} to ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}.`,
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
