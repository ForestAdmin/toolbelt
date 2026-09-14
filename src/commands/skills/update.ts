import type { Agent, PluginAgent } from '../../services/skills/skills-manager';

import { Flags } from '@oclif/core';

import AbstractCommand from '../../abstract-command';
import {
  AGENT_LABELS,
  MARKETPLACE_REPO,
  SKILLS_DIR,
  contextFileGroups,
  fetchMarketplace,
  forestBlock,
  hasPluginCli,
  installSkills,
  isPluginAgent,
  mergeBlock,
  readManifest,
  removeStaleSkillFiles,
  skillDirEntries,
  upgradePlugins,
  writeManifest,
} from '../../services/skills/skills-manager';

export default class SkillsUpdateCommand extends AbstractCommand {
  static override description =
    'Refresh what `forest skills:init` installed (anti-drift): re-installs the Forest plugin for ' +
    'Claude Code / Codex, and re-copies the skills for the other agents — overwriting the managed ' +
    'files and pruning what was dropped upstream (git shows the diff). Files you wrote yourself are ' +
    'left untouched.';

  static override flags = {
    ref: Flags.string({ description: 'Marketplace version (git ref).', default: 'main' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsUpdateCommand);

    const manifest = readManifest();
    if (!manifest) {
      this.logger.error('No Forest skills found in this repo.');
      this.logger.log(`help: run ${this.chalk.bold('forest skills:init')} first.`);
      this.exit(1);

      return;
    }

    // An update targets the requested ref (default main) — but never silently: an install pinned
    // to a tag/SHA jumping refs must be visible, and the way back must be obvious.
    if (manifest.ref && manifest.ref !== flags.ref) {
      this.logger.warn(
        `Skills were installed from "${manifest.ref}"; updating to "${flags.ref}". ` +
          `Pass ${this.chalk.bold(`--ref ${manifest.ref}`)} to stay pinned.`,
      );
    }

    // Refresh exactly the agents the install targeted: refreshing one agent must never treat
    // another's files as stale. A manifest with no `agents` predates that field; it can only have
    // come from a copy-route install, so treat it as one — reading it as "no agents" would refresh
    // nothing AND rewrite the manifest without its files, orphaning every skill on disk.
    const agents = (manifest.agents?.length ? manifest.agents : ['other']) as Agent[];
    const pluginAgents = agents.filter(isPluginAgent);
    const copyAgents = agents.filter(agent => !isPluginAgent(agent));

    pluginAgents.forEach(agent => this.upgradePluginFor(agent, flags.ref));

    const files = copyAgents.length ? await this.refreshSkills(manifest.files, flags.ref) : [];

    // One merged block per FILE, not per agent — AGENTS.md serves Codex, Cursor and OpenCode.
    const groups = contextFileGroups(agents);
    groups.forEach((groupAgents, file) => mergeBlock(file, forestBlock(groupAgents)));

    writeManifest({
      ref: flags.ref,
      installedAt: new Date().toISOString(),
      agents,
      files: [...files, ...groups.keys()],
    });
  }

  private upgradePluginFor(agent: PluginAgent, ref: string): void {
    if (!hasPluginCli(agent)) {
      this.logger.warn(
        `${AGENT_LABELS[agent]}: CLI not on your PATH — skipping its plugin refresh.`,
      );

      return;
    }
    const { installed, failed } = upgradePlugins(agent, ref);
    if (installed.length) {
      this.logger.success(
        `${AGENT_LABELS[agent]}: Forest plugins refreshed (${installed.join(', ')}).`,
        {
          lineColor: 'green',
        },
      );
    }
    if (failed.length) {
      this.logger.warn(`${AGENT_LABELS[agent]}: could not refresh ${failed.join(', ')}.`);
    }
  }

  private async refreshSkills(previousFiles: string[], ref: string): Promise<string[]> {
    this.logger.info(`Refreshing Forest skills from ${MARKETPLACE_REPO}@${ref}…`);
    const { root: srcRoot, cleanup } = await fetchMarketplace(ref);
    try {
      // The managed skill files previously installed — candidates for stale-pruning.
      const oldSkillFiles = skillDirEntries(previousFiles);
      // force: managed files are Forest-owned. `previousFiles` still bounds what may be
      // overwritten, so a same-named file the user wrote is preserved, not silently replaced.
      const { written, skipped } = installSkills(srcRoot, true, previousFiles);

      // Deletions: managed skill files removed upstream are removed locally.
      const removed = removeStaleSkillFiles(oldSkillFiles, written);

      this.logger.success(
        `Forest skills refreshed in ${SKILLS_DIR}/ (${written.length} files, ${removed.length} removed).`,
        { lineColor: 'green' },
      );
      if (skipped.length) {
        this.logger.warn(
          `Kept your own version of ${skipped.length} file(s) we've never written: ${skipped.join(
            ', ',
          )}.`,
        );
      }

      return written;
    } finally {
      cleanup();
    }
  }
}
