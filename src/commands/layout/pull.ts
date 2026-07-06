import type { LayoutScope } from '../../services/layout/types';
import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import { serializeLayoutFile } from '../../services/layout/layout-file';
import LayoutManager from '../../services/layout/layout-manager';
import { PULL_DOMAINS, fetchRemoteDocs, summarize } from '../../services/layout/read';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import {
  isSafeWorkflowId,
  selectStaleSidecars,
  sidecarPath,
} from '../../services/layout/workflow-sidecar';

/** An unresolvable BPMN ref: the S3 version is gone (404), not an auth/network error. */
function isDeadBpmnRef(error: unknown): boolean {
  return error instanceof LayoutApiError && error.status === 404;
}

/**
 * Download one workflow's BPMN, returning '' when the ref is dead (a version
 * baked but never uploaded to this bucket). Genuine failures (auth, network,
 * server) propagate so an incomplete pull is never mistaken for a clean one.
 */
async function downloadWorkflowSidecar(
  manager: LayoutManager,
  scope: LayoutScope,
  workflow: { bpmnAwsS3Identifier?: string; collectionId: string; id: string },
  renderingId: number,
): Promise<string> {
  try {
    return await manager.getWorkflowBpmn(
      scope,
      workflow.id,
      workflow.collectionId,
      workflow.bpmnAwsS3Identifier as string,
      renderingId,
    );
  } catch (error) {
    if (isDeadBpmnRef(error)) return '';

    throw error;
  }
}

type WorkflowRef = { bpmnAwsS3Identifier?: string; collectionId: string; id: string };
type SidecarDownloads = { downloads: Array<{ bpmn: string; id: string }>; skipped: string[] };

/** Download each workflow's stored BPMN into memory (no disk write here). */
async function downloadWorkflowBpmns(
  manager: LayoutManager,
  scope: LayoutScope,
  workflows: WorkflowRef[],
): Promise<SidecarDownloads> {
  const downloads: Array<{ bpmn: string; id: string }> = [];
  const skipped: string[] = [];

  const withBpmn = workflows.filter(workflow => workflow.bpmnAwsS3Identifier);
  if (withBpmn.length === 0) return { downloads, skipped };

  const renderingId = await manager.getRenderingId(scope);
  // eslint-disable-next-line no-restricted-syntax -- sequential: one signed download at a time
  for (const workflow of withBpmn) {
    // A workflow id becomes a filename — reject traversal before touching disk.
    if (!isSafeWorkflowId(workflow.id)) {
      skipped.push(String(workflow.id));
    } else {
      // eslint-disable-next-line no-await-in-loop -- intentional sequential downloads
      const bpmn = await downloadWorkflowSidecar(manager, scope, workflow, renderingId);
      if (bpmn) downloads.push({ bpmn, id: workflow.id });
      else skipped.push(workflow.id);
    }
  }

  return { downloads, skipped };
}

const DEFAULT_OUTPUT = 'forest-layout.json';

/**
 * `forest layout pull` — read the live rendering of an environment/team and
 * write it to a versionable forest-layout.json. First milestone of the
 * declarative layout-as-code flow (pull → diff → apply).
 */
export default class LayoutPullCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  static override description =
    'Pull the layout (rendering) of an environment into a forest-layout.json file.';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description:
        'Environment to pull from (name or id). Defaults to the environment of FOREST_ENV_SECRET ' +
        'when set, otherwise the development environment.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team whose layout to pull (name or id). Defaults to the "Operations" team.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (resolved automatically when you only have one).',
    }),
    out: Flags.string({
      char: 'o',
      description: `Output file path (default: ${DEFAULT_OUTPUT}).`,
      default: DEFAULT_OUTPUT,
    }),
    'with-workflows': Flags.boolean({
      description:
        "Also download each workflow's BPMN into sidecar files (workflows/<id>.bpmn) for round-trip.",
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  protected async runAuthenticated(): Promise<void> {
    const { flags } = await this.parse(LayoutPullCommand);

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();
    const docs = await fetchRemoteDocs(manager, scope, PULL_DOMAINS);
    const content = serializeLayoutFile(scope, docs, () => new Date());
    const workflows = (docs.workflows ?? []) as WorkflowRef[];

    // Download every BPMN into memory BEFORE writing anything, so a mid-pull
    // network error leaves the previous layout + sidecars fully intact instead
    // of a fresh layout mixed with stale, unpruned sidecars.
    const sidecars = flags['with-workflows']
      ? await downloadWorkflowBpmns(manager, scope, workflows)
      : null;

    // Sidecars first, layout last: the layout file is the source of truth, so it
    // only replaces the previous snapshot once the sidecars have converged. A
    // sidecar write failure leaves the old layout + old sidecars intact.
    const outputPath = path.resolve(process.cwd(), flags.out);
    if (sidecars) {
      this.writeWorkflowSidecars(
        path.join(path.dirname(outputPath), 'workflows'),
        sidecars,
        workflows,
      );
    }
    writeFileSync(outputPath, content);

    const { collections, workflows: workflowCount } = summarize(docs);
    this.logger.success(
      `Pulled the layout of ${this.chalk.bold(scope.environmentName)} / ${this.chalk.bold(
        scope.teamName,
      )} into ${this.chalk.bold(
        flags.out,
      )} (${collections} collections, ${workflowCount} workflows).`,
    );
  }

  /**
   * Write the downloaded sidecars, then prune the STALE ones: only files named
   * like a managed sidecar whose workflow no longer exists in the environment.
   * Sidecars of still-existing workflows are always kept — including those whose
   * download was skipped (dead S3 ref): that file may be the last copy of the
   * BPMN, and a backup tool must never destroy the backup. Every deletion is
   * logged. The prune runs even when nothing was downloaded, so a layout whose
   * workflows all lost their BPMN still converges to a faithful mirror.
   */
  private writeWorkflowSidecars(
    dir: string,
    sidecars: SidecarDownloads,
    workflows: WorkflowRef[],
  ): void {
    if (sidecars.downloads.length === 0 && !existsSync(dir)) {
      this.warnSkipped(sidecars.skipped);
      return;
    }

    mkdirSync(dir, { recursive: true });
    sidecars.downloads.forEach(({ bpmn, id }) =>
      writeFileSync(sidecarPath(dir, id) as string, bpmn),
    );

    const keep = new Set(workflows.map(workflow => String(workflow.id)));
    selectStaleSidecars(readdirSync(dir), keep).forEach(entry => {
      unlinkSync(path.join(dir, entry));
      this.log(`  ↺ pruned stale sidecar ${entry}`);
    });

    this.log(
      `  ↓ ${sidecars.downloads.length} workflow BPMN → ${path.relative(process.cwd(), dir)}/`,
    );
    this.warnSkipped(sidecars.skipped);
  }

  private warnSkipped(skipped: string[]): void {
    if (skipped.length === 0) return;

    this.logger.warn(
      `Skipped ${skipped.length} workflow BPMN with an unresolvable ref (not uploaded to this env) — their existing ` +
        `sidecar files, if any, were kept: ${skipped.join(', ')}.`,
    );
  }
}
