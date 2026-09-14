const fs = require('fs');
const os = require('os');
const path = require('path');

const testCli = require('../test-cli-helper/test-cli');

// Mock ONLY the network fetch and the agent-CLI calls: the command's real orchestration
// (route split, install, block merge, manifest write) runs for real against a fake bundle.
jest.mock('../../../src/services/skills/skills-manager', () => ({
  ...jest.requireActual('../../../src/services/skills/skills-manager'),
  fetchMarketplace: jest.fn(),
  hasPluginCli: jest.fn(),
  installPlugins: jest.fn(),
}));

const SkillsInitCommand = require('../../../src/commands/skills/init').default;
const {
  SKILLS_DIR,
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

function mockPipeline({ cliPresent = true, failed = [] } = {}) {
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

    it('warns and skips the agent when its CLI is not on the PATH', async () => {
      expect.hasAssertions();
      mockPipeline({ cliPresent: false });

      await testCli({
        commandClass: SkillsInitCommand,
        commandArgs: ['--agent', 'claude'],
        std: [{ out: "Claude Code selected but its CLI isn't on your PATH" }],
      });

      expect(installPlugins).not.toHaveBeenCalled();
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
          { out: 'Claude Code: could not install forest-docs' },
        ],
      });

      expect(installPlugins).toHaveBeenCalledTimes(1);
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
