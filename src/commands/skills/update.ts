import { Flags } from '@oclif/core';

import AbstractCommand from '../../abstract-command';
import {
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

export default class SkillsUpdateCommand extends AbstractCommand {
  static override description =
    'Refresh the Forest skills in this repo from ForestAdmin/ai-marketplace (anti-drift). ' +
    'Overwrites the managed skill files and prunes ones dropped upstream (git shows the diff); ' +
    'files you added yourself inside the skill dirs are left untouched.';

  static override flags = {
    ref: Flags.string({ description: 'Marketplace version (git ref).', default: 'main' }),
  };

  // Always refresh both agents (matches skills:init) — avoids the class of bug where refreshing
  // one agent treats the other agent's files as stale and deletes them.
  private static readonly agents = ['claude', 'codex'];

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsUpdateCommand);

    const manifest = readManifest();
    if (!manifest) {
      this.logger.error('No Forest skills found in this repo.');
      this.logger.log(`help: run ${this.chalk.bold('forest skills:init')} first.`);
      this.exit(1);

      return;
    }

    const { agents } = SkillsUpdateCommand;

    // Fail fast BEFORE any disk mutation: a broken local .mcp.json would otherwise only surface
    // in installDocsMcp, at the very end, leaving a half-applied refresh behind (same as init).
    validateLocalMcp();

    // An update targets the requested ref (default main) — but never silently: an install pinned
    // to a tag/SHA jumping refs must be visible, and the way back must be obvious.
    if (manifest.ref && manifest.ref !== flags.ref) {
      this.logger.warn(
        `Skills were installed from "${manifest.ref}"; updating to "${flags.ref}". ` +
          `Pass ${this.chalk.bold(`--ref ${manifest.ref}`)} to stay pinned.`,
      );
    }

    this.logger.info(`Refreshing Forest skills from ForestAdmin/ai-marketplace@${flags.ref}…`);
    const { root: srcRoot, cleanup } = await fetchMarketplace(flags.ref);
    try {
      // Still before any write: the bundle must carry the docs MCP config, or the last step
      // would fail with a raw ENOENT after skills/context files were already refreshed.
      validateMarketplaceBundle(srcRoot, flags.ref);

      // The managed skill files previously installed — candidates for stale-pruning.
      const oldSkillFiles = skillDirEntries(manifest.files);

      const skillFiles = agents.flatMap(agent => {
        const written = installSkills(srcRoot, agent, true); // force: managed files are Forest-owned
        const contextFile = contextFileFor(agent);
        mergeBlock(contextFile, FOREST_BLOCK); // refreshes only the Forest block; user content untouched

        return [...written, contextFile];
      });

      // Deletions: managed skill files removed upstream are removed locally.
      const removed = removeStaleSkillFiles(oldSkillFiles, skillFiles);

      const files = [...skillFiles, installDocsMcp(srcRoot)];

      writeManifest({ ref: flags.ref, installedAt: new Date().toISOString(), agents, files });

      this.logger.success(
        `Forest skills refreshed for ${agents.join(', ')} (${files.length} files, ${
          removed.length
        } removed).`,
        { lineColor: 'green' },
      );
    } finally {
      cleanup();
    }
  }
}
