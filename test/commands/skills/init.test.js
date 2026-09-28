const fs = require('fs');
const os = require('os');
const path = require('path');

const testCli = require('../test-cli-helper/test-cli');

// Mock ONLY the network fetch and the agent-CLI calls: the command's real orchestration
// (route split, install, block merge, manifest write) runs for real against a fake bundle.
jest.mock('../../../src/services/skills/skills-manager', () => ({
  ...jest.requireActual('../../../src/services/skills/skills-manager'),
  detectAgents: jest.fn(),
  fetchMarketplace: jest.fn(),
  hasPluginCli: jest.fn(),
  installPlugins: jest.fn(),
}));

const SkillsInitCommand = require('../../../src/commands/skills/init').default;
const {
  SKILLS_DIR,
  detectAgents,
  fetchMarketplace,
  hasPluginCli,
  installPlugins,
} = require('../../../src/services/skills/skills-manager');

// Build a fake extracted marketplace: each plugin ships its skills as SKILL.md dirs, exactly as
// the real bundle does — including deploy-heroku, which the old curated list dropped.
const BUNDLE_SKILLS = {
  forest: [
    'boot-standalone-agent',
    'deploy-heroku',
    'layout',
    'management',
    'onboard',
    'workflows',
  ],
  'forest-code': ['forest-code', 'forest-legacy'],
};

function makeFakeBundle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-init-test-'));
  const write = (p, c) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  Object.entries(BUNDLE_SKILLS).forEach(([plugin, skills]) =>
    skills.forEach(skill =>
      write(path.join(root, plugin, 'skills', skill, 'SKILL.md'), `# ${skill} skill`),
    ),
  );
  return root;
}

function mockPipeline({ cliPresent = true, failed = [], detected = [] } = {}) {
  detectAgents.mockReset();
  detectAgents.mockReturnValue(detected);
  fetchMarketplace.mockReset();
  fetchMarketplace.mockImplementation(async () => {
    const root = makeFakeBundle();
    return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
  });
  hasPluginCli.mockReset();
  hasPluginCli.mockReturnValue(cliPresent);
  installPlugins.mockReset();
  installPlugins.mockImplementation(agent => ({
    agent,
    installed: failed.length ? ['forest'] : ['forest', 'forest-code', 'forest-docs'],
    failed,
  }));
}

async function runCliKeepingProjectDir(options) {
  const previousFlag = process.env.KEEP_TEMPORARY_FILES;
  process.env.KEEP_TEMPORARY_FILES = '1';
  try {
    await testCli(options);
  } finally {
    if (previousFlag === undefined) delete process.env.KEEP_TEMPORARY_FILES;
    else process.env.KEEP_TEMPORARY_FILES = previousFlag;
  }
  return options.files[0].chdir;
}

const skill = (...parts) => path.join(SKILLS_DIR, ...parts);

// The command asks only when stdout is a terminal, so a scripted run is one whose stdout is not.
const withTerminal = plan =>
  plan.replace(
    'env/others/process',
    Object.create(process, { stdout: { value: { isTTY: true } } }),
  );

// Matches the prompt's `validate` by what it does, since a function never equals another.
const refusesAnEmptyPick = {
  asymmetricMatch: validate =>
    validate([]) === 'Pick at least one agent.' && validate(['cursor']) === true,
};

const withoutTerminal = plan =>
  plan.replace(
    'env/others/process',
    Object.create(process, { stdout: { value: { isTTY: false } } }),
  );

describe('skills:init', () => {
  describe('with a plugin-route agent (--agent claude)', () => {
    it('drives the agent CLI and writes nothing into the repo but CLAUDE.md + the manifest', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [
          { out: 'Claude Code: installed the Forest plugins' },
          { out: 'Restart Claude Code to load the plugin' },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        expect(installPlugins).toHaveBeenCalledWith('claude', 'main');
        // Plugin route: no tarball, no skills copied anywhere.
        expect(fetchMarketplace).not.toHaveBeenCalled();
        expect(fs.existsSync(at(SKILLS_DIR))).toBe(false);
        expect(fs.existsSync(at('.claude/skills'))).toBe(false);
        // The agent still needs to know this repo is a Forest project.
        expect(fs.readFileSync(at('CLAUDE.md'), 'utf8')).toContain('`forest` plugin');
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.agents).toStrictEqual(['claude']);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('exits non-zero and records nothing when the only agent asked for could not be set up', async () => {
      expect.hasAssertions();
      mockPipeline({ cliPresent: false });

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        files: [{ name: 'placeholder', content: 'x' }],
        exitCode: 1,
        std: [
          { out: "Claude Code selected but its CLI isn't on your PATH" },
          { err: 'Nothing was installed, so nothing was recorded.' },
        ],
      });

      try {
        expect(installPlugins).not.toHaveBeenCalled();
        // No manifest, so a later `skills:update` has nothing to misread as a copy install.
        expect(fs.existsSync(path.join(projectDir, '.forest/skills-manifest.json'))).toBe(false);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('does not claim a skipped agent in the manifest or its context file', async () => {
      expect.hasAssertions();
      mockPipeline({ cliPresent: false });

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude', '--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [{ out: "Claude Code selected but its CLI isn't on your PATH" }],
      });

      try {
        const at = p => path.join(projectDir, p);
        // Nothing was installed for Claude Code, so nothing may say it was.
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.agents).toStrictEqual(['cursor']);
        expect(fs.existsSync(at('CLAUDE.md'))).toBe(false);
        // The agent that did get set up is unaffected.
        expect(fs.existsSync(at(skill('layout', 'SKILL.md')))).toBe(true);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('reports a plugin that failed to install without failing the whole run', async () => {
      expect.hasAssertions();
      mockPipeline({ failed: ['forest-docs'] });

      await testCli({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        std: [
          { out: 'Claude Code: installed the Forest plugin (forest).' },
          {
            out: 'Claude Code: could not install forest-docs. Retry by hand with `claude plugin install forest-docs@forest-admin-ai --scope project`.',
          },
        ],
      });

      expect(installPlugins).toHaveBeenCalledTimes(1);
      expect(installPlugins).toHaveBeenCalledWith('claude', 'main');
    });

    it('exits non-zero and records nothing when every Forest plugin fails to install', async () => {
      expect.hasAssertions();
      mockPipeline();
      installPlugins.mockImplementation(agent => ({
        agent,
        installed: [],
        failed: ['forest', 'forest-code', 'forest-docs'],
      }));

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        files: [{ name: 'placeholder', content: 'x' }],
        exitCode: 1,
        std: [
          { out: 'Claude Code: could not install forest, forest-code, forest-docs.' },
          { err: 'Nothing was installed, so nothing was recorded.' },
        ],
      });

      try {
        expect(fs.existsSync(path.join(projectDir, '.forest/skills-manifest.json'))).toBe(false);
        expect(fs.existsSync(path.join(projectDir, 'CLAUDE.md'))).toBe(false);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('sets up the other agents when one agent CLI fails to add the marketplace', async () => {
      expect.hasAssertions();
      mockPipeline();
      installPlugins.mockImplementation(agent => {
        if (agent === 'codex')
          throw new Error('`codex plugin marketplace add` failed: unknown command.');

        return { agent, installed: ['forest', 'forest-code', 'forest-docs'], failed: [] };
      });

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude', '--agent', 'codex', '--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [{ out: 'Codex: `codex plugin marketplace add` failed: unknown command.' }],
      });

      try {
        const at = p => path.join(projectDir, p);
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.agents).toStrictEqual(['claude', 'cursor']);
        expect(fs.existsSync(at(skill('layout', 'SKILL.md')))).toBe(true);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('keeps the copy-route agent and files an earlier run recorded', async () => {
      expect.hasAssertions();
      mockPipeline();
      const earlierFiles = [skill('layout', 'SKILL.md'), 'AGENTS.md'];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        files: [
          {
            name: '.forest/skills-manifest.json',
            content: JSON.stringify({
              ref: 'main',
              installedAt: '2026-01-01T00:00:00.000Z',
              agents: ['cursor'],
              files: earlierFiles,
            }),
          },
          { name: skill('layout', 'SKILL.md'), content: '# layout skill' },
        ],
        std: [{ out: 'Claude Code: installed the Forest plugins' }],
      });

      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(projectDir, '.forest/skills-manifest.json'), 'utf8'),
        );
        expect(manifest.agents).toStrictEqual(['claude', 'cursor']);
        expect(manifest.files).toStrictEqual([
          skill('layout', 'SKILL.md'),
          'CLAUDE.md',
          'AGENTS.md',
        ]);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });

  describe('with a copy-route agent (--agent cursor)', () => {
    it('copies the skills into the cross-agent dir and records them', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [
          { out: 'Fetching Forest skills from ForestAdmin/ai-marketplace@main' },
          { out: 'Forest skills copied to .agents/skills/' },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        expect(installPlugins).not.toHaveBeenCalled();
        expect(fs.readFileSync(at(skill('layout', 'SKILL.md')), 'utf8')).toBe('# layout skill');
        // AGENTS.md is the cross-agent context file; CLAUDE.md is not this agent's business.
        expect(fs.readFileSync(at('AGENTS.md'), 'utf8')).toContain(SKILLS_DIR);
        expect(fs.existsSync(at('CLAUDE.md'))).toBe(false);
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.files).toContain(skill('layout', 'SKILL.md'));
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('never claims a pre-existing user skill dir in the manifest', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'cursor'],
        files: [{ name: skill('layout', 'SKILL.md'), content: 'my own skill' }],
        std: [{ out: 'Forest skills copied to .agents/skills/' }],
      });

      try {
        const at = p => path.join(projectDir, p);
        // Untouched on disk…
        expect(fs.readFileSync(at(skill('layout', 'SKILL.md')), 'utf8')).toBe('my own skill');
        // …and never recorded as managed, or a later refresh would prune it.
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.files).not.toContain(skill('layout', 'SKILL.md'));
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });

  describe('with both routes at once (--agent claude --agent cursor)', () => {
    it('installs the plugin AND copies the skills, recording both agents', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude', '--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [
          { out: 'Claude Code: installed the Forest plugins' },
          { out: 'Forest skills copied to .agents/skills/' },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        expect(installPlugins).toHaveBeenCalledWith('claude', 'main');
        expect(fs.existsSync(at(skill('layout', 'SKILL.md')))).toBe(true);
        // Both context files, each worded for its own route.
        expect(fs.readFileSync(at('CLAUDE.md'), 'utf8')).toContain('`forest` plugin');
        expect(fs.readFileSync(at('AGENTS.md'), 'utf8')).toContain(SKILLS_DIR);
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.agents).toStrictEqual(['claude', 'cursor']);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });

  describe('when the copy route fails after the plugin route installed', () => {
    it('still records the plugin agent in the manifest and its context file', async () => {
      expect.hasAssertions();
      mockPipeline();
      fetchMarketplace.mockImplementation(async () => {
        throw new Error('Timed out reaching the Forest marketplace.');
      });

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude', '--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [
          { out: 'Claude Code: installed the Forest plugins' },
          {
            out: 'Could not copy the Forest skills into .agents/skills/: Timed out reaching the Forest marketplace.',
          },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.agents).toStrictEqual(['claude']);
        expect(fs.existsSync(at('CLAUDE.md'))).toBe(true);
        expect(fs.existsSync(at('AGENTS.md'))).toBe(false);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('exits non-zero and records nothing when the copy route was the only one asked for', async () => {
      expect.hasAssertions();
      mockPipeline();
      fetchMarketplace.mockImplementation(async () => {
        throw new Error('Timed out reaching the Forest marketplace.');
      });

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        exitCode: 1,
        std: [
          { out: 'Could not copy the Forest skills into .agents/skills/' },
          { err: 'Nothing was installed, so nothing was recorded.' },
        ],
      });

      try {
        expect(fs.existsSync(path.join(projectDir, '.forest/skills-manifest.json'))).toBe(false);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });

  describe('when one context file serves both routes (--agent codex --agent cursor)', () => {
    it('writes a single AGENTS.md block covering the plugin AND the copied skills', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'codex', '--agent', 'cursor'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [{ out: 'Forest skills copied to .agents/skills/' }],
      });

      try {
        const agentsMd = fs.readFileSync(path.join(projectDir, 'AGENTS.md'), 'utf8');
        // Both routes described — the second merge used to replace the first.
        expect(agentsMd).toContain('`forest` plugin');
        expect(agentsMd).toContain(SKILLS_DIR);
        expect(agentsMd.match(/<!-- forest:begin -->/g)).toHaveLength(1);
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });

  describe('without --agent, in a terminal', () => {
    it('asks which agents to set up, pre-checking the detected ones', async () => {
      expect.hasAssertions();
      mockPipeline({ detected: ['claude'] });
      // testCli's own prompt double knows no checkbox, so this test brings its own inquirer.
      const inquirer = { prompt: jest.fn().mockResolvedValue({ chosen: ['claude'] }) };

      await testCli({
        commandClass: SkillsInitCommand,
        additionnalStep: plan =>
          withTerminal(plan).replace('dependencies/inquirer/inquirer', inquirer),
        std: [{ out: 'Claude Code: installed the Forest plugins' }],
      });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'checkbox',
          name: 'chosen',
          message: 'Which coding agent(s) do you use? (space to select, enter to confirm)',
          choices: [
            { name: 'Claude Code', value: 'claude', checked: true },
            { name: 'Codex', value: 'codex', checked: false },
            { name: 'Cursor', value: 'cursor', checked: false },
            { name: 'OpenCode', value: 'opencode', checked: false },
            { name: 'Other (any SKILL.md-compatible agent)', value: 'other', checked: false },
          ],
          validate: refusesAnEmptyPick,
        },
      ]);
      expect(installPlugins).toHaveBeenCalledWith('claude', 'main');
    });
  });

  describe('without --agent, outside a terminal', () => {
    it('fails with the flag to pass when no agent is detected', async () => {
      expect.hasAssertions();
      mockPipeline({ detected: [] });

      await testCli({
        commandClass: SkillsInitCommand,
        additionnalStep: withoutTerminal,
        exitMessage:
          'No coding agent detected and no --agent given. Re-run with --agent <claude|codex|cursor|opencode|other>.',
      });

      expect(installPlugins).not.toHaveBeenCalled();
      expect(fetchMarketplace).not.toHaveBeenCalled();
    });

    it('sets up the detected agents without prompting', async () => {
      expect.hasAssertions();
      mockPipeline({ detected: ['claude'] });

      await testCli({
        commandClass: SkillsInitCommand,
        additionnalStep: withoutTerminal,
        std: [{ out: 'Detected Claude Code.' }],
      });

      expect(installPlugins).toHaveBeenCalledWith('claude', 'main');
    });
  });

  describe('--ref', () => {
    it('is passed through to both routes and recorded in the manifest', async () => {
      expect.hasAssertions();
      mockPipeline();

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude', '--agent', 'cursor', '--ref', 'v2.1.0'],
        files: [{ name: 'placeholder', content: 'x' }],
        std: [{ out: 'Fetching Forest skills from ForestAdmin/ai-marketplace@v2.1.0' }],
      });

      try {
        expect(installPlugins).toHaveBeenCalledWith('claude', 'v2.1.0');
        expect(fetchMarketplace).toHaveBeenCalledWith('v2.1.0');
        const manifest = JSON.parse(
          fs.readFileSync(path.join(projectDir, '.forest/skills-manifest.json'), 'utf8'),
        );
        expect(manifest.ref).toBe('v2.1.0');
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });
  });
});
