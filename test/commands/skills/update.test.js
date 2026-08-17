const fs = require('fs');
const os = require('os');
const path = require('path');

const testCli = require('../test-cli-helper/test-cli');

// Mock ONLY the network fetch and the agent-CLI calls: the command's real orchestration
// (route split, install, block merge, stale-pruning, manifest rewrite) runs for real against a
// fake extracted bundle on disk.
jest.mock('../../../src/services/skills/skills-manager', () => ({
  ...jest.requireActual('../../../src/services/skills/skills-manager'),
  fetchMarketplace: jest.fn(),
  hasPluginCli: jest.fn(),
  upgradePlugins: jest.fn(),
}));

const SkillsUpdateCommand = require('../../../src/commands/skills/update').default;
const {
  SKILLS_DIR,
  fetchMarketplace,
  hasPluginCli,
  upgradePlugins,
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-update-test-'));
  const write = (p, c) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  Object.entries(BUNDLE_SKILLS).forEach(([plugin, skills]) =>
    skills.forEach(skill =>
      write(path.join(root, plugin, 'skills', skill, 'SKILL.md'), `# ${skill} skill (fresh)`),
    ),
  );
  return root;
}

function mockPipeline({ cliPresent = true } = {}) {
  fetchMarketplace.mockReset();
  fetchMarketplace.mockImplementation(async () => {
    const root = makeFakeBundle();
    return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
  });
  hasPluginCli.mockReset();
  hasPluginCli.mockReturnValue(cliPresent);
  upgradePlugins.mockReset();
  upgradePlugins.mockImplementation(agent => ({ agent, installed: ['forest'], failed: [] }));
}

// Run testCli but keep the temporary project directory so the resulting disk state can be
// asserted; returns that directory — the caller must remove it afterwards.
async function runCliKeepingProjectDir(options) {
  const previousFlag = process.env.KEEP_TEMPORARY_FILES;
  process.env.KEEP_TEMPORARY_FILES = '1';
  try {
    await testCli(options);
  } finally {
    if (previousFlag === undefined) delete process.env.KEEP_TEMPORARY_FILES;
    else process.env.KEEP_TEMPORARY_FILES = previousFlag;
  }
  // testCli assigns the temporary project directory to each file lacking an explicit chdir.
  return options.files[0].chdir;
}

const previousManifest = (ref, files, agents = ['cursor']) =>
  JSON.stringify({ ref, installedAt: '2026-01-01T00:00:00.000Z', agents, files });

const skill = (...parts) => path.join(SKILLS_DIR, ...parts);

describe('skills:update', () => {
  describe('when no manifest exists', () => {
    it('exits with an error and never reaches the marketplace', async () => {
      expect.hasAssertions();
      mockPipeline();

      await testCli({
        commandClass: SkillsUpdateCommand,
        exitCode: 1,
        std: [
          { err: 'No Forest skills found in this repo.' },
          { out: 'help: run forest skills:init first.' },
        ],
      });

      // Bailed out before the pipeline: nothing fetched, hence nothing written.
      expect(fetchMarketplace).not.toHaveBeenCalled();
    });
  });

  describe('on the copy route', () => {
    it('refreshes managed files, prunes stale ones and rewrites the manifest', async () => {
      expect.hasAssertions();
      mockPipeline();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('main', [
            skill('layout', 'SKILL.md'),
            skill('old-skill', 'SKILL.md'), // left the upstream bundle since
            'AGENTS.md',
          ]),
        },
        { name: skill('layout', 'SKILL.md'), content: 'outdated content' },
        { name: skill('old-skill', 'SKILL.md'), content: 'stale content' },
      ];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsUpdateCommand,
        files,
        std: [
          { out: 'Refreshing Forest skills from ForestAdmin/ai-marketplace@main' },
          { out: 'Forest skills refreshed in .agents/skills/' },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        // Managed file refreshed from the bundle.
        expect(fs.readFileSync(at(skill('layout', 'SKILL.md')), 'utf8')).toBe(
          '# layout skill (fresh)',
        );
        // Stale managed file (in the old manifest, gone upstream) pruned.
        expect(fs.existsSync(at(skill('old-skill', 'SKILL.md')))).toBe(false);
        // Freshly installed files NOT pruned (removeStaleSkillFiles argument order).
        expect(fs.existsSync(at(skill('forest-code', 'SKILL.md')))).toBe(true);
        // Claude Code's dir is never written on the copy route — it gets the plugin instead.
        expect(fs.existsSync(at('.claude/skills'))).toBe(false);
        // Manifest rewritten with the effective ref and the refreshed file list.
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.ref).toBe('main');
        expect(manifest.files).toContain(skill('forest-code', 'SKILL.md'));
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('keeps a user-authored file that collides with a bundle path instead of overwriting it', async () => {
      expect.hasAssertions();
      mockPipeline();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          // The manifest never claimed layout/SKILL.md → we never wrote it → it is the user's.
          content: previousManifest('main', [skill('onboard', 'SKILL.md')]),
        },
        { name: skill('onboard', 'SKILL.md'), content: 'managed, will be refreshed' },
        { name: skill('layout', 'SKILL.md'), content: 'my own skill' },
      ];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsUpdateCommand,
        files,
        std: [{ out: "Kept your own version of 1 file(s) we've never written" }],
      });

      try {
        const at = p => path.join(projectDir, p);
        expect(fs.readFileSync(at(skill('layout', 'SKILL.md')), 'utf8')).toBe('my own skill');
        // …while the file we did write is refreshed as usual.
        expect(fs.readFileSync(at(skill('onboard', 'SKILL.md')), 'utf8')).toBe(
          '# onboard skill (fresh)',
        );
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('logs the ref transition when the manifest was pinned to another ref', async () => {
      expect.hasAssertions();
      mockPipeline();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('v2.1.0', [skill('layout', 'SKILL.md')]),
        },
        { name: skill('layout', 'SKILL.md'), content: 'outdated content' },
      ];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsUpdateCommand,
        files,
        std: [
          { out: 'Skills were installed from "v2.1.0"; updating to "main".' },
          { out: '--ref v2.1.0' }, // the way back to the pin is spelled out
          { out: 'Forest skills refreshed' },
        ],
      });

      try {
        // The de-pin is applied (and recorded) — only the silence around it was the bug.
        const manifest = JSON.parse(
          fs.readFileSync(path.join(projectDir, '.forest/skills-manifest.json'), 'utf8'),
        );
        expect(manifest.ref).toBe('main');
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('passes the requested --ref through to the fetch and the manifest', async () => {
      expect.hasAssertions();
      mockPipeline();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('v2.1.0', [skill('layout', 'SKILL.md')]),
        },
        { name: skill('layout', 'SKILL.md'), content: 'outdated content' },
      ];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsUpdateCommand,
        commandArgs: ['--ref', 'v2.1.0'],
        files,
        // Staying on the pinned ref: no transition warning to emit.
        std: [{ out: 'Refreshing Forest skills from ForestAdmin/ai-marketplace@v2.1.0' }],
      });

      try {
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

  describe('on the plugin route', () => {
    it('re-installs the plugin and never fetches the tarball', async () => {
      expect.hasAssertions();
      mockPipeline();

      await testCli({
        commandClass: SkillsUpdateCommand,
        files: [
          {
            name: '.forest/skills-manifest.json',
            content: previousManifest('main', ['CLAUDE.md'], ['claude']),
          },
        ],
        std: [{ out: 'Claude Code: Forest plugins refreshed (forest)' }],
      });

      expect(upgradePlugins).toHaveBeenCalledWith('claude', 'main');
      // No copy route in play → the marketplace tarball is never downloaded.
      expect(fetchMarketplace).not.toHaveBeenCalled();
    });

    it('warns and carries on when the agent CLI is not installed', async () => {
      expect.hasAssertions();
      mockPipeline({ cliPresent: false });

      await testCli({
        commandClass: SkillsUpdateCommand,
        files: [
          {
            name: '.forest/skills-manifest.json',
            content: previousManifest('main', ['CLAUDE.md'], ['claude']),
          },
        ],
        std: [{ out: 'Claude Code: CLI not on your PATH' }],
      });

      expect(upgradePlugins).not.toHaveBeenCalled();
    });
  });
});
