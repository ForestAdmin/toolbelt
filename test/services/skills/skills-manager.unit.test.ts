import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  SKILL_SOURCES,
  contextFileFor,
  copyDir,
  installDocsMcp,
  installSkills,
  mergeBlock,
  readManifest,
  removeStaleSkillFiles,
  skillDirEntries,
  validateLocalMcp,
  validateMarketplaceBundle,
  writeManifest,
} from '../../../src/services/skills/skills-manager';

// Run `fn` inside a throwaway temp dir (cwd), restoring + cleaning up afterwards.
// A helper (not a jest hook) — this repo forbids beforeEach/afterEach (jest/no-hooks).
function withTempDir(run: (dir: string) => void): void {
  const previousCwd = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
  process.chdir(tmp);
  try {
    run(tmp);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Build a fake extracted marketplace holding every curated skill (derived from SKILL_SOURCES so
// the fixture stays in sync with the real list) + forest-docs/.mcp.json.
function fakeMarketplace(root: string): string {
  const write = (p: string, c: string) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  SKILL_SOURCES.forEach(({ plugin, skills }) =>
    skills.forEach(skill =>
      write(path.join(root, plugin, 'skills', skill, 'SKILL.md'), `# ${skill} skill`),
    ),
  );
  write(path.join(root, 'forest', 'skills', 'layout', 'references', 'a.md'), 'ref a');
  write(
    path.join(root, 'forest-docs', '.mcp.json'),
    JSON.stringify({
      mcpServers: { 'forest-docs': { type: 'http', url: 'https://docs.forest.app/mcp' } },
    }),
  );

  return root;
}

describe('skills-manager', () => {
  describe('contextFileFor', () => {
    it('maps claude to CLAUDE.md', () => {
      expect.assertions(1);
      expect(contextFileFor('claude')).toBe('CLAUDE.md');
    });

    it('maps any other agent to AGENTS.md', () => {
      expect.assertions(1);
      expect(contextFileFor('codex')).toBe('AGENTS.md');
    });
  });

  describe('mergeBlock', () => {
    it('creates the file with a delimited Forest block when absent', () => {
      expect.assertions(2);
      withTempDir(() => {
        mergeBlock('CLAUDE.md', 'hello forest');
        const content = fs.readFileSync('CLAUDE.md', 'utf8');
        expect(content).toContain('<!-- forest:begin -->');
        expect(content).toContain('hello forest');
      });
    });

    it('preserves pre-existing user content and appends the block', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('CLAUDE.md', '# My own notes\n');
        mergeBlock('CLAUDE.md', 'forest block');
        const content = fs.readFileSync('CLAUDE.md', 'utf8');
        expect(content).toContain('# My own notes');
        expect(content).toContain('forest block');
      });
    });

    it('replaces only the Forest block on re-merge, keeping user content', () => {
      expect.assertions(3);
      withTempDir(() => {
        fs.writeFileSync('CLAUDE.md', '# Notes\n');
        mergeBlock('CLAUDE.md', 'version one');
        mergeBlock('CLAUDE.md', 'version two');
        const content = fs.readFileSync('CLAUDE.md', 'utf8');
        expect(content).toContain('# Notes');
        expect(content).toContain('version two');
        expect(content).not.toContain('version one');
      });
    });
  });

  describe('installSkills', () => {
    it('copies the curated skill bundles into the agent dir', () => {
      expect.assertions(3);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const written = installSkills(root, 'claude', false, null);
        expect(fs.existsSync('.claude/skills/layout/SKILL.md')).toBe(true);
        expect(fs.existsSync('.claude/skills/forest-code/SKILL.md')).toBe(true);
        expect(written).toContain(path.join('.claude/skills', 'layout', 'references', 'a.md'));
      });
    });

    it('throws when a curated skill is absent from the marketplace (no misleading partial install)', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const { plugin, skills } = SKILL_SOURCES[0];
        fs.rmSync(path.join(root, plugin, 'skills', skills[0]), { recursive: true, force: true });
        expect(() => installSkills(root, 'claude', false, null)).toThrow(
          /missing from the marketplace/,
        );
      });
    });

    it('skips an already-installed skill unless force is set', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const first = installSkills(root, 'claude', false, null);
        fs.writeFileSync('.claude/skills/layout/SKILL.md', 'edited');
        installSkills(root, 'claude', false, first); // no force → keep edit
        expect(fs.readFileSync('.claude/skills/layout/SKILL.md', 'utf8')).toBe('edited');
        installSkills(root, 'claude', true, first); // force → overwrite
        expect(fs.readFileSync('.claude/skills/layout/SKILL.md', 'utf8')).toBe('# layout skill');
      });
    });

    it('reports existing files on a no-force re-run so the manifest stays complete', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const first = installSkills(root, 'claude', false, null);
        const second = installSkills(root, 'claude', false, first); // skips copy, still lists them
        expect(second).toHaveLength(first.length);
        expect(second).toContain(path.join('.claude/skills', 'layout', 'SKILL.md'));
      });
    });

    it('overlays on force, preserving user-added files in the skill dir (no blind dir wipe)', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const first = installSkills(root, 'claude', false, null);
        fs.writeFileSync('.claude/skills/layout/my-notes.md', 'mine');
        installSkills(root, 'claude', true, first); // force → overlay, not a dir nuke
        expect(fs.readFileSync('.claude/skills/layout/my-notes.md', 'utf8')).toBe('mine');
        expect(fs.readFileSync('.claude/skills/layout/SKILL.md', 'utf8')).toBe('# layout skill');
      });
    });

    it('replaces a stray non-directory sitting where a skill dir belongs', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync('.claude/skills', { recursive: true });
        fs.writeFileSync('.claude/skills/layout', 'stray file, not a dir');
        installSkills(root, 'claude', false, null);
        expect(fs.statSync('.claude/skills/layout').isDirectory()).toBe(true);
        expect(fs.existsSync('.claude/skills/layout/SKILL.md')).toBe(true);
      });
    });

    it('never reports user-added files as managed on a no-force re-run (so they are not pruned)', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const first = installSkills(root, 'claude', false, null);
        fs.writeFileSync('.claude/skills/layout/my-notes.md', 'mine');
        const reported = installSkills(root, 'claude', false, first);
        expect(reported).not.toContain(path.join('.claude/skills', 'layout', 'my-notes.md'));
        expect(reported).toContain(path.join('.claude/skills', 'layout', 'SKILL.md'));
      });
    });

    it('claims nothing for a skill dir that pre-existed the first run (later prune spares it)', () => {
      expect.assertions(3);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        // The user authored their own layout skill BEFORE ever running skills:init.
        fs.mkdirSync('.claude/skills/layout', { recursive: true });
        fs.writeFileSync('.claude/skills/layout/SKILL.md', 'user-authored');
        // First run (no manifest), no --force: the dir is skipped, so nothing in it was written
        // by us and nothing in it may be claimed as managed.
        const written = installSkills(root, 'claude', false, null);
        expect(written).not.toContain(path.join('.claude/skills', 'layout', 'SKILL.md'));
        // Later refresh where `layout` left the upstream bundle: the prune (manifest-scoped) must
        // not touch the user's file, since the manifest never claimed it.
        const removed = removeStaleSkillFiles(skillDirEntries(written), []);
        expect(removed).not.toContain(path.join('.claude/skills', 'layout', 'SKILL.md'));
        expect(fs.readFileSync('.claude/skills/layout/SKILL.md', 'utf8')).toBe('user-authored');
      });
    });

    it('matches previous manifest entries across path separators on the skip path', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        installSkills(root, 'claude', false, null);
        // A manifest written on Windows (backslashes) must still vouch for the same file here.
        const reported = installSkills(root, 'claude', false, [
          '.claude\\skills\\layout\\SKILL.md',
        ]);
        expect(reported).toContain(path.join('.claude/skills', 'layout', 'SKILL.md'));
      });
    });
  });

  describe('copyDir', () => {
    it('replaces a destination symlink instead of following it (no writes outside the project)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('src-skill', { recursive: true });
        fs.writeFileSync('src-skill/SKILL.md', 'new content');
        fs.writeFileSync('outside.md', 'protected');
        fs.mkdirSync('dest', { recursive: true });
        fs.symlinkSync(path.resolve('outside.md'), 'dest/SKILL.md'); // planted link to a file outside
        copyDir('src-skill', 'dest');
        expect(fs.readFileSync('outside.md', 'utf8')).toBe('protected'); // link target untouched
        expect(fs.readFileSync('dest/SKILL.md', 'utf8')).toBe('new content'); // real file written in place
      });
    });

    it('skips a symlink in the SOURCE bundle (never copies through it)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('src-skill', { recursive: true });
        fs.writeFileSync('src-skill/SKILL.md', 'real');
        fs.writeFileSync('secret.txt', 'private'); // a file the crafted symlink would point at
        fs.symlinkSync(path.resolve('secret.txt'), 'src-skill/leak');
        const written = copyDir('src-skill', 'dest');
        expect(fs.existsSync('dest/leak')).toBe(false); // symlink entry skipped, not followed
        expect(written).toStrictEqual([path.join('dest', 'SKILL.md')]); // only the real file copied
      });
    });

    it('refuses a SOURCE dir that is itself a symlink (crafted-marketplace escape)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('host-dir', { recursive: true });
        fs.writeFileSync('host-dir/private.txt', 'local secret');
        fs.symlinkSync(path.resolve('host-dir'), 'src-link'); // the skill dir IS a symlink
        const written = copyDir('src-link', 'dest');
        expect(written).toStrictEqual([]); // nothing copied
        expect(fs.existsSync('dest/private.txt')).toBe(false); // host file not exfiltrated
      });
    });
  });

  describe('symlink-safe writes', () => {
    it('mergeBlock replaces a symlinked context file instead of following it', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('outside.md', 'protected');
        fs.symlinkSync(path.resolve('outside.md'), 'CLAUDE.md');
        mergeBlock('CLAUDE.md', 'forest');
        expect(fs.readFileSync('outside.md', 'utf8')).toBe('protected');
        expect(fs.lstatSync('CLAUDE.md').isSymbolicLink()).toBe(false);
      });
    });

    it('installDocsMcp replaces a symlinked .mcp.json instead of overwriting its target', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.writeFileSync('outside.json', 'protected');
        fs.symlinkSync(path.resolve('outside.json'), '.mcp.json');
        installDocsMcp(root);
        expect(fs.readFileSync('outside.json', 'utf8')).toBe('protected');
        expect(fs.lstatSync('.mcp.json').isSymbolicLink()).toBe(false);
      });
    });

    it('writeManifest does not write through a symlinked .forest dir', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.mkdirSync('outside-dir');
        fs.symlinkSync(path.resolve('outside-dir'), '.forest');
        writeManifest({ ref: 'main', installedAt: 'x', agents: ['claude'], files: [] });
        expect(fs.existsSync('outside-dir/skills-manifest.json')).toBe(false);
      });
    });
  });

  describe('skillDirEntries', () => {
    it('keeps only entries under the skill dirs (normalized), dropping context/mcp files', () => {
      expect.assertions(1);
      expect(
        skillDirEntries([
          '.claude/skills/layout/SKILL.md',
          '.agents\\skills\\layout\\SKILL.md', // windows-style separators
          'CLAUDE.md',
          '.mcp.json',
        ]),
      ).toStrictEqual(['.claude/skills/layout/SKILL.md', '.agents\\skills\\layout\\SKILL.md']);
    });
  });

  describe('removeStaleSkillFiles', () => {
    it('removes a previously-installed file that is gone upstream', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('.claude/skills/layout', { recursive: true });
        fs.writeFileSync('.claude/skills/layout/stale.md', 'old');
        const removed = removeStaleSkillFiles(
          ['.claude/skills/layout/stale.md'],
          ['.claude/skills/layout/fresh.md'],
        );
        expect(removed).toStrictEqual(['.claude/skills/layout/stale.md']);
        expect(fs.existsSync('.claude/skills/layout/stale.md')).toBe(false);
      });
    });

    it('keeps files still produced by the current run', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('.claude/skills/layout', { recursive: true });
        fs.writeFileSync('.claude/skills/layout/keep.md', 'x');
        const removed = removeStaleSkillFiles(
          ['.claude/skills/layout/keep.md'],
          ['.claude/skills/layout/keep.md'],
        );
        expect(removed).toHaveLength(0);
        expect(fs.existsSync('.claude/skills/layout/keep.md')).toBe(true);
      });
    });

    it('ignores previous entries that no longer exist on disk', () => {
      expect.assertions(1);
      withTempDir(() => {
        expect(removeStaleSkillFiles(['.claude/skills/layout/ghost.md'], [])).toHaveLength(0);
      });
    });

    it('refuses to delete a path that escapes the skill dirs (`..` traversal)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('precious.txt', 'keep me');
        const removed = removeStaleSkillFiles(['.claude/skills/../../precious.txt'], []);
        expect(removed).toHaveLength(0);
        expect(fs.existsSync('precious.txt')).toBe(true);
      });
    });

    it('matches previous vs current across path separators (Unix manifest, Windows run)', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.mkdirSync('.claude/skills/layout', { recursive: true });
        fs.writeFileSync('.claude/skills/layout/SKILL.md', 'x');
        // Backslash "previous" must be recognized as the same file as forward-slash "current".
        const removed = removeStaleSkillFiles(
          ['.claude\\skills\\layout\\SKILL.md'],
          ['.claude/skills/layout/SKILL.md'],
        );
        expect(removed).toHaveLength(0);
      });
    });

    it('refuses to delete through a skill dir symlinked outside the project', () => {
      expect.assertions(2);
      const external = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-'));
      try {
        fs.mkdirSync(path.join(external, 'layout'));
        fs.writeFileSync(path.join(external, 'layout', 'old.md'), 'external file');
        withTempDir(() => {
          fs.mkdirSync('.claude', { recursive: true });
          fs.symlinkSync(external, '.claude/skills'); // skills dir → outside the project
          const removed = removeStaleSkillFiles(['.claude/skills/layout/old.md'], []);
          expect(removed).toHaveLength(0);
          expect(fs.existsSync(path.join(external, 'layout', 'old.md'))).toBe(true);
        });
      } finally {
        fs.rmSync(external, { recursive: true, force: true });
      }
    });
  });

  describe('installDocsMcp', () => {
    it('writes the forest-docs MCP server from the marketplace', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        installDocsMcp(root);
        const mcp = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
        expect(mcp.mcpServers['forest-docs'].url).toBe('https://docs.forest.app/mcp');
      });
    });

    it('preserves an existing MCP server the user already had', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.writeFileSync('.mcp.json', JSON.stringify({ mcpServers: { other: { url: 'x' } } }));
        installDocsMcp(root);
        const mcp = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
        expect(mcp.mcpServers.other).toBeDefined();
        expect(mcp.mcpServers['forest-docs']).toBeDefined();
      });
    });

    it('aborts on a malformed existing .mcp.json instead of clobbering it', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.writeFileSync('.mcp.json', '{ not valid json');
        expect(() => installDocsMcp(root)).toThrow(/Cannot parse existing/);
        expect(fs.readFileSync('.mcp.json', 'utf8')).toBe('{ not valid json');
      });
    });

    it('treats a valid-but-non-object .mcp.json (JSON null) as empty instead of crashing', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.writeFileSync('.mcp.json', 'null');
        installDocsMcp(root);
        const mcp = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
        expect(mcp.mcpServers['forest-docs']).toBeDefined();
      });
    });
  });

  describe('validateLocalMcp', () => {
    it('passes when no .mcp.json exists', () => {
      expect.assertions(1);
      withTempDir(() => {
        expect(() => validateLocalMcp()).not.toThrow();
      });
    });

    it('passes on a parsable .mcp.json', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.writeFileSync('.mcp.json', JSON.stringify({ mcpServers: {} }));
        expect(() => validateLocalMcp()).not.toThrow();
      });
    });

    it('throws a clear error on an unparsable .mcp.json (fail fast, before any install)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('.mcp.json', '{ not valid json');
        expect(() => validateLocalMcp()).toThrow(/Cannot parse existing \.mcp\.json/);
        expect(fs.readFileSync('.mcp.json', 'utf8')).toBe('{ not valid json'); // left untouched
      });
    });

    it('passes on a symlinked .mcp.json (replaced, never read, at install time)', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.writeFileSync('outside.json', '{ not valid json');
        fs.symlinkSync(path.resolve('outside.json'), '.mcp.json');
        expect(() => validateLocalMcp()).not.toThrow();
      });
    });
  });

  describe('validateMarketplaceBundle', () => {
    it('passes when the bundle carries forest-docs/.mcp.json', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        expect(() => validateMarketplaceBundle(root, 'main')).not.toThrow();
      });
    });

    it('throws a clear error naming the ref when forest-docs/.mcp.json is missing', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.rmSync(path.join(root, 'forest-docs'), { recursive: true, force: true });
        expect(() => validateMarketplaceBundle(root, 'v1.2.3')).toThrow(
          /ref "v1\.2\.3" has no forest-docs\/\.mcp\.json/,
        );
      });
    });
  });

  describe('manifest', () => {
    it('returns null when no manifest exists', () => {
      expect.assertions(1);
      withTempDir(() => {
        expect(readManifest()).toBeNull();
      });
    });

    it('returns null for a valid-but-malformed manifest (no files array)', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('.forest', { recursive: true });
        fs.writeFileSync('.forest/skills-manifest.json', '{}');
        expect(readManifest()).toBeNull();
        fs.writeFileSync('.forest/skills-manifest.json', '[]');
        expect(readManifest()).toBeNull();
      });
    });

    it('round-trips through write/read', () => {
      expect.assertions(1);
      withTempDir(() => {
        const manifest = {
          ref: 'main',
          installedAt: '2026-01-01',
          agents: ['claude'],
          files: ['a'],
        };
        writeManifest(manifest);
        expect(readManifest()).toStrictEqual(manifest);
      });
    });
  });
});
