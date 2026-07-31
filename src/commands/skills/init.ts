import { Flags } from '@oclif/core';

import AbstractCommand from '../../abstract-command';
import {
  AGENT_SKILL_DIRS,
  FOREST_BLOCK,
  contextFileFor,
  fetchMarketplace,
  installDocsMcp,
  installSkills,
  mergeBlock,
  readManifest,
  removeStaleSkillFiles,
  skillDirEntries,
  validateLocalMcp,
  validateMarketplaceBundle,
  writeManifest,
} from '../../services/skills/skills-manager';

export default class SkillsInitCommand extends AbstractCommand {
  static override description =
    'Install the Forest skills into this repo so your coding agent (Claude Code / Codex) knows Forest — project-scoped, no marketplace add.';

  static override flags = {
    ref: Flags.string({ description: 'Marketplace version (git ref).', default: 'main' }),
    force: Flags.boolean({ description: 'Overwrite existing skill files.', default: false }),
  };

  // Always set up both agents — the files for the one you don't use are inert, and this keeps
  // the repo ready whichever coding agent a teammate opens it with.
  private static readonly agents = ['claude', 'codex'];

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsInitCommand);
    const { agents } = SkillsInitCommand;
    const previous = readManifest(); // to prune Forest files that left the bundle on a re-install

    // Fail fast BEFORE any disk mutation: a broken local .mcp.json would otherwise only surface
    // in installDocsMcp, at the very end, leaving a half-applied install behind.
    validateLocalMcp();

    this.logger.info(
      `Fetching Forest skills from ${this.chalk.bold('ForestAdmin/ai-marketplace')}@${flags.ref}…`,
    );
    const { root: srcRoot, cleanup } = await fetchMarketplace(flags.ref);
    try {
      // Still before any write: the bundle must carry the docs MCP config, or the last step
      // would fail with a raw ENOENT after skills/context files were already applied.
      validateMarketplaceBundle(srcRoot, flags.ref);

      const skillFiles = agents.flatMap(agent => {
        const written = installSkills(srcRoot, agent, flags.force, previous?.files ?? null);
        const contextFile = contextFileFor(agent);
        mergeBlock(contextFile, FOREST_BLOCK);
        this.logger.success(`Forest skills installed for ${agent} → ${AGENT_SKILL_DIRS[agent]}`, {
          lineColor: 'green',
        });

        return [...written, contextFile];
      });

      // Prune only Forest-managed skill files that were installed before and are no longer in the
      // bundle (manifest-scoped) — user-added files in the skill dirs are left untouched.
      if (previous) removeStaleSkillFiles(skillDirEntries(previous.files), skillFiles);

      // Wire the Forest docs MCP (fetched from the marketplace's forest-docs plugin).
      const files = [...skillFiles, installDocsMcp(srcRoot)];

      writeManifest({ ref: flags.ref, installedAt: new Date().toISOString(), agents, files });

      this.logger.info(
        'Open this repo in Claude Code or Codex — it now knows Forest. Refresh later with `forest skills:update`.',
      );
    } finally {
      cleanup();
    }
  }
}
