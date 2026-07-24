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
  writeManifest,
} from '../../services/skills/skills-manager';

export default class SkillsUpdateCommand extends AbstractCommand {
  static override description =
    'Refresh the Forest skills in this repo from ForestAdmin/ai-marketplace (anti-drift).';

  static override flags = {
    ref: Flags.string({ description: 'Marketplace version (git ref).', default: 'main' }),
    // TODO: show a diff and gate on confirmation unless --yes (interactive follow-up).
    yes: Flags.boolean({
      char: 'y',
      description: 'Apply without confirmation (CI).',
      default: false,
    }),
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

    this.logger.info(`Refreshing Forest skills from ForestAdmin/ai-marketplace@${flags.ref}…`);
    const { root: srcRoot, cleanup } = await fetchMarketplace(flags.ref);
    try {
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
