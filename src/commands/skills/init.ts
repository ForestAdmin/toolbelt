import type { Agent, PluginAgent } from '../../services/skills/skills-manager';

import { Flags } from '@oclif/core';

import AbstractCommand from '../../abstract-command';
import {
  AGENT_LABELS,
  ALL_AGENTS,
  MARKETPLACE_REPO,
  SKILLS_DIR,
  contextFileFor,
  detectAgents,
  fetchMarketplace,
  forestBlock,
  hasPluginCli,
  installPlugins,
  installSkills,
  isPluginAgent,
  mergeBlock,
  readManifest,
  removeStaleSkillFiles,
  skillDirEntries,
  writeManifest,
} from '../../services/skills/skills-manager';

export default class SkillsInitCommand extends AbstractCommand {
  static override description =
    'Give your coding agent the Forest skills: installs the Forest plugin (Claude Code, Codex) or copies the skills into the repo (Cursor, OpenCode, …).';

  static override flags = {
    agent: Flags.string({
      description: `Coding agent(s) to set up: ${ALL_AGENTS.join(
        ', ',
      )}. Repeatable. Skips the prompt — required in non-interactive runs.`,
      multiple: true,
      options: [...ALL_AGENTS],
    }),
    ref: Flags.string({ description: 'Marketplace version (git ref).', default: 'main' }),
    force: Flags.boolean({
      description: 'Overwrite skill files already installed by a previous run (copy route only).',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillsInitCommand);
    const agents = await this.resolveAgents(flags.agent as Agent[] | undefined);

    const pluginAgents = agents.filter(isPluginAgent);
    const copyAgents = agents.filter(agent => !isPluginAgent(agent));

    // Plugin route first: it touches nothing in the repo beyond `.claude/settings.json`, so a
    // failure here leaves the working tree as it was.
    const pluginOk = pluginAgents.filter(agent => this.installPluginFor(agent, flags.ref));

    const files = copyAgents.length ? await this.copySkills(flags.ref, flags.force) : [];

    // Context files: tell the agent this repo is a Forest project, whichever route it came by.
    const contextFiles = [...new Set(agents.map(contextFileFor))];
    agents.forEach(agent => mergeBlock(contextFileFor(agent), forestBlock(agent)));

    writeManifest({
      ref: flags.ref,
      installedAt: new Date().toISOString(),
      agents,
      files: [...files, ...contextFiles],
    });

    this.logNextSteps(pluginOk, copyAgents);
  }

  /** Explicit `--agent` wins; otherwise detect, and only ask when there's a terminal to ask in. */
  private async resolveAgents(fromFlag?: Agent[]): Promise<Agent[]> {
    if (fromFlag?.length) return [...new Set(fromFlag)];

    const detected = detectAgents();
    const { inquirer, process: proc } = this.context;
    const interactive = proc?.stdout?.isTTY ?? process.stdout.isTTY;

    if (!interactive) {
      if (!detected.length) {
        throw new Error(
          `No coding agent detected and no --agent given. Re-run with --agent <${ALL_AGENTS.join(
            '|',
          )}>.`,
        );
      }
      this.logger.info(`Detected ${detected.map(a => AGENT_LABELS[a]).join(', ')}.`);

      return detected;
    }

    const { chosen } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'chosen',
        message: 'Which coding agent(s) do you use?',
        choices: ALL_AGENTS.map(agent => ({
          name: AGENT_LABELS[agent],
          value: agent,
          checked: detected.includes(agent),
        })),
        validate: (picked: string[]) => picked.length > 0 || 'Pick at least one agent.',
      },
    ]);

    return chosen;
  }

  /** Drive the agent's own plugin CLI. Returns false (and warns) when it can't be used. */
  private installPluginFor(agent: PluginAgent, ref: string): boolean {
    if (!hasPluginCli(agent)) {
      this.logger.warn(
        `${AGENT_LABELS[agent]} selected but its CLI isn't on your PATH — skipping. ` +
          `Install it, then re-run \`forest skills:init --agent ${agent}\`.`,
      );

      return false;
    }

    const { installed, failed } = installPlugins(agent, ref);
    if (installed.length) {
      this.logger.success(
        `${AGENT_LABELS[agent]}: installed the Forest plugin${
          installed.length > 1 ? 's' : ''
        } (${installed.join(', ')}).`,
        { lineColor: 'green' },
      );
    }
    if (failed.length) {
      this.logger.warn(
        `${AGENT_LABELS[agent]}: could not install ${failed.join(', ')}. ` +
          `Retry by hand with \`${agent} plugin install <name>@forest-admin-ai\`.`,
      );
    }

    return installed.length > 0;
  }

  /** Copy the curated skills into `.agents/skills/` for the agents that only read SKILL.md files. */
  private async copySkills(ref: string, force: boolean): Promise<string[]> {
    const previous = readManifest(); // to prune Forest files that left the bundle on a re-install

    this.logger.info(`Fetching Forest skills from ${this.chalk.bold(MARKETPLACE_REPO)}@${ref}…`);
    const { root: srcRoot, cleanup } = await fetchMarketplace(ref);
    try {
      const { written, skipped } = installSkills(srcRoot, force, previous?.files ?? null);

      // Prune only Forest-managed skill files that were installed before and are no longer in the
      // bundle (manifest-scoped) — user-added files in the skill dirs are left untouched.
      if (previous) removeStaleSkillFiles(skillDirEntries(previous.files), written);

      this.logger.success(`Forest skills copied to ${SKILLS_DIR}/`, { lineColor: 'green' });
      if (skipped.length) {
        this.logger.warn(
          `Kept your own version of ${skipped.length} file(s) we've never written: ${skipped.join(
            ', ',
          )}. Delete them and re-run to take the Forest version.`,
        );
      }

      return written;
    } finally {
      cleanup();
    }
  }

  private logNextSteps(pluginAgents: PluginAgent[], copyAgents: Agent[]): void {
    if (pluginAgents.length) {
      this.logger.info(
        `Restart ${pluginAgents
          .map(a => AGENT_LABELS[a])
          .join(' / ')} to load the plugin — then try \`/forest:start\`.`,
      );
    }
    if (pluginAgents.includes('claude')) {
      this.logger.info(
        'Commit `.claude/settings.json` so your teammates get the same plugin (they run `claude plugin install forest@forest-admin-ai` once).',
      );
    }
    if (copyAgents.length) {
      this.logger.info(
        `Commit \`${SKILLS_DIR}/\` so your teammates get the skills at clone. Refresh later with \`forest skills:update\`.`,
      );
    }
  }
}
