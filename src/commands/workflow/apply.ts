import type { LayoutScope } from '../../services/layout/types';
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

/** Find the workflow to upsert: by explicit `id`, else by name + collection. */
function findWorkflowMatch(
  existing: RemoteWorkflow[],
  id: string | undefined,
  name: string,
  collection: string,
): RemoteWorkflow | undefined {
  if (id) return existing.find(workflow => workflow.id === id);

  return existing.find(workflow => workflow.name === name && workflow.collectionId === collection);
}

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
 * Upload the compiled BPMN and link it to the workflow. If this fails right
 * after a new shell was created, roll the shell back (best-effort) so no
 * unusable, BPMN-less workflow is left behind (an existing workflow is left as
 * is — its previous BPMN stays linked and re-applying converges).
 */
async function uploadAndLinkBpmn(
  manager: LayoutManager,
  scope: LayoutScope,
  params: { bpmn: string; collection: string; created: boolean; id: string },
): Promise<void> {
  try {
    const renderingId = await manager.getRenderingId(scope);
    const version = await manager.uploadWorkflowBpmn(
      scope,
      params.id,
      params.collection,
      renderingId,
      params.bpmn,
    );
    await manager.patchDomain(
      'workflows',
      [{ op: 'replace', path: `/workflows/${params.id}/bpmnAwsS3Identifier`, value: version }],
      scope,
    );
  } catch (uploadError) {
    if (params.created) {
      await manager
        .patchDomain('workflows', [{ op: 'remove', path: `/workflows/${params.id}` }], scope)
        .catch(() => undefined);
    }

    throw uploadError;
  }
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
      const match = findWorkflowMatch(existing, spec.id, name, collection);

      // `collectionId` is add-only server-side: matching an existing workflow by
      // `id` but pointing it at a different collection would upload BPMN for the
      // new collection against the old shell, silently corrupting it. Reject it.
      if (match && match.collectionId !== collection) {
        throw new Error(
          `Workflow "${match.id}" is on collection "${match.collectionId}", not "${collection}". ` +
            'A workflow cannot change collection — remove the `id`/rename to create a new one.',
        );
      }

      const id = match?.id ?? spec.id ?? randomUUID();
      const created = !match;

      if (created) {
        await addWorkflowShell(manager, scope, {
          collection,
          id,
          name,
          position: existing.length,
          segments: spec.segments ?? [],
        });
      }

      await uploadAndLinkBpmn(manager, scope, { bpmn, collection, created, id });

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
