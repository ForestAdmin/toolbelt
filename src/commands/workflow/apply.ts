import type { WorkflowSpec } from '../../services/layout/workflow-bpmn';
import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import LayoutManager from '../../services/layout/layout-manager';
import { explainApiError } from '../../services/layout/plan-format';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { compileWorkflowToBpmn } from '../../services/layout/workflow-bpmn';

type RemoteWorkflow = { collectionId: string; id: string; name: string };

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

async function readInput(filePath: string | undefined): Promise<string> {
  if (!filePath || filePath === '-') return readStdin();

  return readFile(filePath, 'utf8');
}

/**
 * `forest workflow apply` — create-or-update ONE workflow from a JSON `steps`
 * spec, without touching the rest of the layout. The spec is the source of
 * truth: editing a workflow (e.g. adding a step) means editing the JSON and
 * re-applying — the whole BPMN is recompiled and re-uploaded (it is atomic;
 * there is no per-step patch). Upsert is matched by explicit `id`, else by
 * name + collection.
 *
 * Sequence: compile steps -> BPMN; PATCH add the workflow (if new); upload the
 * BPMN to the env's S3 (presigned); PATCH the returned `bpmnAwsS3Identifier`.
 */
export default class WorkflowApplyCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  static override args = {
    file: Args.string({
      description:
        'JSON workflow spec ({ name, collection, steps, id?, segments? }). "-" or omit to read stdin.',
      required: false,
    }),
  };

  static override description =
    'Create or update a workflow from a JSON steps spec (compiles to BPMN and uploads it).';

  static override flags = {
    'dry-run': Flags.boolean({ description: 'Compile and validate only; do not send anything.' }),
    env: Flags.string({ char: 'e', description: 'Environment name or id.' }),
    projectId: Flags.integer({ char: 'p', description: 'Project id.' }),
    team: Flags.string({ char: 't', description: 'Team name or id.' }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  protected async runAuthenticated(): Promise<void> {
    const { args, flags } = await this.parse(WorkflowApplyCommand);

    const spec = JSON.parse(await readInput(args.file)) as Partial<WorkflowSpec> & { id?: string };

    // compileWorkflowToBpmn validates the spec (name/collection/steps) and throws WorkflowSpecError.
    const bpmn = compileWorkflowToBpmn(spec);
    const collection = spec.collection as string;
    const name = spec.name as string;
    const stepCount = (spec.steps ?? []).length;

    if (flags['dry-run']) {
      this.log(
        `workflow "${name}" on ${collection}: ${stepCount} steps → ${bpmn.length} bytes of BPMN`,
      );
      this.log('\n(dry-run: nothing sent)');

      return;
    }

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();

    try {
      const existing = (await manager.getLayoutDomain('workflows', scope)) as RemoteWorkflow[];
      const match = existing.find(workflow =>
        spec.id
          ? workflow.id === spec.id
          : workflow.name === name && workflow.collectionId === collection,
      );
      const id = match?.id ?? spec.id ?? randomUUID();

      if (!match) {
        await manager.patchDomain(
          'workflows',
          [
            {
              op: 'add',
              path: '/workflows/-',
              value: {
                collectionId: collection,
                id,
                isVisible: true,
                name,
                position: existing.length,
                segmentIds: spec.segments ?? [],
              },
            },
          ],
          scope,
        );
      }

      const renderingId = await manager.getRenderingId(scope);
      const version = await manager.uploadWorkflowBpmn(scope, id, collection, renderingId, bpmn);
      await manager.patchDomain(
        'workflows',
        [{ op: 'replace', path: `/workflows/${id}/bpmnAwsS3Identifier`, value: version }],
        scope,
      );

      this.logger.success(
        `${match ? 'Updated' : 'Created'} workflow ${this.chalk.bold(
          name,
        )} (${stepCount} steps) on ${this.chalk.bold(scope.environmentName)} / ${this.chalk.bold(
          scope.teamName,
        )}.`,
      );
    } catch (error) {
      if (error instanceof LayoutApiError && error.status !== 401) {
        this.logger.error(explainApiError(error, []));
        this.exit(2);
      }

      throw error;
    }
  }
}
