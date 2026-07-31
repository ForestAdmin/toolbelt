const fs = require('fs');
const os = require('os');
const path = require('path');

const testCli = require('../test-cli-helper/test-cli');

// Mock ONLY the network fetch: the command's real orchestration (validation, install, block
// merge, stale-pruning, manifest rewrite) runs against a fake extracted bundle on disk.
jest.mock('../../../src/services/skills/skills-manager', () => ({
  ...jest.requireActual('../../../src/services/skills/skills-manager'),
  fetchMarketplace: jest.fn(),
}));

const SkillsUpdateCommand = require('../../../src/commands/skills/update').default;
const { SKILL_SOURCES, fetchMarketplace } = require('../../../src/services/skills/skills-manager');

// Build a fake extracted marketplace holding every curated skill (derived from SKILL_SOURCES so
// the fixture stays in sync with the real list) + forest-docs/.mcp.json.
function makeFakeBundle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-update-test-'));
  const write = (p, c) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  SKILL_SOURCES.forEach(({ plugin, skills }) =>
    skills.forEach(skill =>
      write(path.join(root, plugin, 'skills', skill, 'SKILL.md'), `# ${skill} skill (fresh)`),
    ),
  );
  write(
    path.join(root, 'forest-docs', '.mcp.json'),
    JSON.stringify({
      mcpServers: { 'forest-docs': { type: 'http', url: 'https://docs.forest.app/mcp' } },
    }),
  );
  return root;
}

function mockMarketplaceFetch() {
  fetchMarketplace.mockReset();
  fetchMarketplace.mockImplementation(async () => {
    const root = makeFakeBundle();
    return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
  });
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

const previousManifest = (ref, files) =>
  JSON.stringify({ ref, installedAt: '2026-01-01T00:00:00.000Z', agents: ['claude'], files });

describe('skills:update', () => {
  describe('when no manifest exists', () => {
    it('exits with an error and never reaches the marketplace', async () => {
      expect.hasAssertions();
      mockMarketplaceFetch();

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

  describe('when the local .mcp.json is unparsable', () => {
    it('fails fast before fetching or mutating anything', async () => {
      expect.hasAssertions();
      mockMarketplaceFetch();

      await testCli({
        commandClass: SkillsUpdateCommand,
        files: [
          {
            name: '.forest/skills-manifest.json',
            content: previousManifest('main', ['.claude/skills/layout/SKILL.md']),
          },
          { name: '.mcp.json', content: '{ not valid json' },
        ],
        exitMessage:
          "Cannot parse existing .mcp.json; aborting before any changes so it isn't overwritten. " +
          'Fix or remove it, then re-run.',
      });

      expect(fetchMarketplace).not.toHaveBeenCalled();
    });
  });

  describe('when a manifest exists', () => {
    it('refreshes managed files, prunes stale ones and rewrites the manifest', async () => {
      expect.hasAssertions();
      mockMarketplaceFetch();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('main', [
            '.claude/skills/layout/SKILL.md',
            '.claude/skills/old-skill/SKILL.md', // left the upstream bundle since
            'CLAUDE.md',
            '.mcp.json',
          ]),
        },
        { name: '.claude/skills/layout/SKILL.md', content: 'outdated content' },
        { name: '.claude/skills/old-skill/SKILL.md', content: 'stale content' },
      ];

      const projectDir = await runCliKeepingProjectDir({
        commandClass: SkillsUpdateCommand,
        files,
        std: [
          { out: 'Refreshing Forest skills from ForestAdmin/ai-marketplace@main' },
          { out: 'Forest skills refreshed for claude, codex' },
        ],
      });

      try {
        const at = p => path.join(projectDir, p);
        // Managed file refreshed from the bundle.
        expect(fs.readFileSync(at('.claude/skills/layout/SKILL.md'), 'utf8')).toBe(
          '# layout skill (fresh)',
        );
        // Stale managed file (in the old manifest, gone upstream) pruned.
        expect(fs.existsSync(at('.claude/skills/old-skill/SKILL.md'))).toBe(false);
        // Freshly installed files NOT pruned (removeStaleSkillFiles argument order).
        expect(fs.existsSync(at('.claude/skills/forest-code/SKILL.md'))).toBe(true);
        expect(fs.existsSync(at('.agents/skills/layout/SKILL.md'))).toBe(true);
        // Manifest rewritten with the effective ref and the refreshed file list.
        const manifest = JSON.parse(fs.readFileSync(at('.forest/skills-manifest.json'), 'utf8'));
        expect(manifest.ref).toBe('main');
        expect(manifest.files).toContain(path.join('.claude/skills', 'forest-code', 'SKILL.md'));
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    });

    it('logs the ref transition when the manifest was pinned to another ref', async () => {
      expect.hasAssertions();
      mockMarketplaceFetch();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('v2.1.0', ['.claude/skills/layout/SKILL.md']),
        },
        { name: '.claude/skills/layout/SKILL.md', content: 'outdated content' },
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
      mockMarketplaceFetch();

      const files = [
        {
          name: '.forest/skills-manifest.json',
          content: previousManifest('v2.1.0', ['.claude/skills/layout/SKILL.md']),
        },
        { name: '.claude/skills/layout/SKILL.md', content: 'outdated content' },
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
});
