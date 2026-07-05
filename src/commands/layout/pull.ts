import type { LayoutScope } from '../../services/layout/types';
import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import { serializeLayoutFile } from '../../services/layout/layout-file';
import LayoutManager from '../../services/layout/layout-manager';
import { PULL_DOMAINS, fetchRemoteDocs, summarize } from '../../services/layout/read';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { sidecarPath } from '../../services/layout/workflow-sidecar';

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

/** Remove `<id>.bpmn` files that were not (re)written this pull, so a mirror stays a mirror. */
function pruneStaleSidecars(dir: string, keep: Set<string>): string[] {
  const pruned: string[] = [];
  readdirSync(dir).forEach(entry => {
    const match = entry.match(/^(.+)\.bpmn$/);
    if (match && !keep.has(match[1])) {
      unlinkSync(path.join(dir, entry));
      pruned.push(match[1]);
    }
  });

  return pruned;
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

    const outputPath = path.resolve(process.cwd(), flags.out);
    writeFileSync(outputPath, content);

    if (flags['with-workflows']) {
      await this.pullWorkflowBpmns(
        manager,
        scope,
        (docs.workflows ?? []) as Array<{
          bpmnAwsS3Identifier?: string;
          collectionId: string;
          id: string;
        }>,
        outputPath,
      );
    }

    const { collections, workflows } = summarize(docs);
    this.logger.success(
      `Pulled the layout of ${this.chalk.bold(scope.environmentName)} / ${this.chalk.bold(
        scope.teamName,
      )} into ${this.chalk.bold(flags.out)} (${collections} collections, ${workflows} workflows).`,
    );
  }

  /** Download each workflow's stored BPMN into `workflows/<id>.bpmn` next to the layout file. */
  private async pullWorkflowBpmns(
    manager: LayoutManager,
    scope: LayoutScope,
    workflows: Array<{ bpmnAwsS3Identifier?: string; collectionId: string; id: string }>,
    outputPath: string,
  ): Promise<void> {
    const withBpmn = workflows.filter(workflow => workflow.bpmnAwsS3Identifier);
    if (withBpmn.length === 0) return;

    const renderingId = await manager.getRenderingId(scope);
    const dir = path.join(path.dirname(outputPath), 'workflows');
    mkdirSync(dir, { recursive: true });

    const saved: string[] = [];
    const skipped: string[] = [];
    // eslint-disable-next-line no-restricted-syntax -- sequential: one signed download at a time
    for (const workflow of withBpmn) {
      // A workflow id becomes a filename — reject traversal before touching disk.
      const file = sidecarPath(dir, workflow.id);
      if (!file) {
        skipped.push(String(workflow.id));
      } else {
        // eslint-disable-next-line no-await-in-loop -- intentional sequential downloads
        const bpmn = await downloadWorkflowSidecar(manager, scope, workflow, renderingId);
        if (bpmn) {
          writeFileSync(file, bpmn);
          saved.push(workflow.id);
        } else {
          skipped.push(workflow.id);
        }
      }
    }

    // A pull mirrors the env: drop sidecars for workflows we did not just write
    // (deleted, or now unresolvable) so a later apply can't re-upload stale BPMN.
    const pruned = pruneStaleSidecars(dir, new Set(saved));

    this.log(`  ↓ ${saved.length} workflow BPMN → ${path.relative(process.cwd(), dir)}/`);
    if (pruned.length > 0) this.log(`  ↺ pruned ${pruned.length} stale sidecar(s)`);
    if (skipped.length > 0) {
      this.logger.warn(
        `Skipped ${
          skipped.length
        } workflow BPMN with an unresolvable ref (not uploaded to this env): ${skipped.join(
          ', ',
        )}.`,
      );
    }
  }
}
