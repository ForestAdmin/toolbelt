import type { Agent, PluginAgent, PluginInstallResult } from '../../services/skills/skills-manager';

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
  manifestAgents,
  manifestRefs,
  mergeBlock,
  readManifest,
  refsAfter,
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
    // to a tag/SHA jumping refs must be visible, and the way back must be obvious. Each agent is
    // judged by the ref its own content came from, since one run can leave agents on different refs.
    const refs = manifestRefs(manifest);
    const pinned = [...new Set(Object.values(refs))].filter(ref => ref && ref !== flags.ref);
    pinned.forEach(ref => {
      const labels = Object.keys(refs)
        .filter(agent => refs[agent] === ref)
        .map(agent => AGENT_LABELS[agent as Agent]);
      this.logger.warn(
        `${labels.join(', ')}: skills were installed from "${ref}"; updating to "${flags.ref}". ` +
          `Pass ${this.chalk.bold(`--ref ${ref}`)} to stay pinned.`,
      );
    });

    // Refresh exactly the agents the install targeted: refreshing one agent must never treat
    // another's files as stale.
    const agents = manifestAgents(manifest);
    if (!agents.length) {
      this.logger.warn(
        `No coding agent is recorded in this repo. Run ${this.chalk.bold(
          'forest skills:init --agent <name>',
        )} to set one up.`,
      );

      return;
    }
    const pluginAgents = agents.filter(isPluginAgent);
    const copyAgents = agents.filter(agent => !isPluginAgent(agent));

    const pluginRefreshed = pluginAgents.filter(agent => this.upgradePluginFor(agent, flags.ref));

    const files = copyAgents.length ? await this.refreshSkills(manifest.files, flags.ref) : [];

    // One merged block per FILE, not per agent — AGENTS.md serves Codex, Cursor and OpenCode.
    const groups = contextFileGroups(agents);
    groups.forEach((groupAgents, file) => mergeBlock(file, forestBlock(groupAgents)));

    writeManifest({
      ref: flags.ref,
      installedAt: new Date().toISOString(),
      agents,
      // An agent whose refresh failed or was skipped keeps the ref its content still comes from.
      refs: refsAfter(refs, [...pluginRefreshed, ...copyAgents], agents, flags.ref),
      files: [...files, ...groups.keys()],
    });
  }

  /** True only when every Forest plugin was refreshed, so the agent now runs the requested ref. */
  private upgradePluginFor(agent: PluginAgent, ref: string): boolean {
    if (!hasPluginCli(agent)) {
      this.logger.warn(
        `${AGENT_LABELS[agent]}: CLI not on your PATH — skipping its plugin refresh.`,
      );

      return false;
    }
    let result: PluginInstallResult;
    try {
      result = upgradePlugins(agent, ref);
    } catch (error) {
      // One agent's CLI failing must not cost the others their refresh, nor the run its manifest.
      this.logger.warn(`${AGENT_LABELS[agent]}: ${error.message}`);

      return false;
    }

    const { installed, failed } = result;
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

    return installed.length > 0 && !failed.length;
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
