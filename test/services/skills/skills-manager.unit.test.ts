import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  FOREST_PLUGINS,
  MARKETPLACE_REPO,
  SKILLS_DIR,
  contextFileFor,
  contextFileGroups,
  copyDir,
  detectAgents,
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
} from '../../../src/services/skills/skills-manager';

const spawnSync = jest.fn();

jest.mock('child_process', () => ({ spawnSync: (...args) => spawnSync(...args) }));

// Every CLI call succeeds, unless `failing` matches the joined args.
function mockCli({ failing = null }: { failing?: RegExp | null } = {}) {
  spawnSync.mockReset();
  spawnSync.mockImplementation((bin, args) => ({
    status: failing && failing.test(args.join(' ')) ? 1 : 0,
    stdout: '',
    stderr: '',
  }));
}

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

// Build a fake extracted marketplace: each plugin ships its skills as SKILL.md dirs, exactly as
// the real bundle does. `deploy-heroku` is in there on purpose — the old curated list excluded it
// while the plugin route shipped it, which is the drift this fixture must be able to catch.
const BUNDLE_SKILLS: Record<string, string[]> = {
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

function fakeMarketplace(root: string): string {
  const write = (p: string, c: string) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c);
  };
  Object.entries(BUNDLE_SKILLS).forEach(([plugin, skills]) =>
    skills.forEach(skill =>
      write(path.join(root, plugin, 'skills', skill, 'SKILL.md'), `# ${skill} skill`),
    ),
  );
  write(path.join(root, 'forest', 'skills', 'layout', 'references', 'a.md'), 'ref a');

  return root;
}

const layoutSkill = path.join(SKILLS_DIR, 'layout', 'SKILL.md');

describe('skills-manager', () => {
  describe('agent families', () => {
    it('routes claude and codex through their plugin CLI, everyone else through file copy', () => {
      expect.assertions(5);
      expect(isPluginAgent('claude')).toBe(true);
      expect(isPluginAgent('codex')).toBe(true);
      expect(isPluginAgent('cursor')).toBe(false);
      expect(isPluginAgent('opencode')).toBe(false);
      expect(isPluginAgent('other')).toBe(false);
    });

    it('maps claude to CLAUDE.md and every other agent to the cross-agent AGENTS.md', () => {
      expect.assertions(4);
      expect(contextFileFor('claude')).toBe('CLAUDE.md');
      expect(contextFileFor('codex')).toBe('AGENTS.md');
      expect(contextFileFor('cursor')).toBe('AGENTS.md');
      expect(contextFileFor('opencode')).toBe('AGENTS.md');
    });

    it('words the context block for the route actually applied', () => {
      expect.assertions(4);
      expect(forestBlock(['claude'])).toContain('`forest` plugin');
      expect(forestBlock(['claude'])).not.toContain(SKILLS_DIR);
      expect(forestBlock(['cursor'])).toContain(SKILLS_DIR);
      expect(forestBlock(['cursor'])).not.toContain('`forest` plugin');
    });

    it('covers BOTH routes in one block when a single context file serves both', () => {
      expect.assertions(2);
      // AGENTS.md is Codex's (plugin) and Cursor's (copy) alike.
      const block = forestBlock(['codex', 'cursor']);
      expect(block).toContain('`forest` plugin');
      expect(block).toContain(SKILLS_DIR);
    });

    it('groups agents by context file so each file is merged exactly once', () => {
      expect.assertions(3);
      const groups = contextFileGroups(['claude', 'codex', 'cursor', 'opencode']);
      expect([...groups.keys()].sort()).toStrictEqual(['AGENTS.md', 'CLAUDE.md']);
      expect(groups.get('CLAUDE.md')).toStrictEqual(['claude']);
      expect(groups.get('AGENTS.md')).toStrictEqual(['codex', 'cursor', 'opencode']);
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
    it('copies the skill bundles into the single cross-agent skills dir', () => {
      expect.assertions(3);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const { written } = installSkills(root, false, null);
        expect(fs.existsSync(layoutSkill)).toBe(true);
        expect(fs.existsSync(path.join(SKILLS_DIR, 'forest-code', 'SKILL.md'))).toBe(true);
        expect(written).toContain(path.join(SKILLS_DIR, 'layout', 'references', 'a.md'));
      });
    });

    it('never writes into .claude/skills (Claude Code is served by the plugin route)', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        installSkills(root, false, null);
        expect(fs.existsSync('.claude')).toBe(false);
      });
    });

    it('ships every skill the plugins carry, so the copy route matches the plugin route', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        installSkills(root, false, null);
        const shipped = fs.readdirSync(SKILLS_DIR).sort();
        expect(shipped).toStrictEqual(Object.values(BUNDLE_SKILLS).flat().sort());
        // The one the old curated list dropped, while `onboard` kept pointing at it.
        expect(shipped).toContain('deploy-heroku');
      });
    });

    it('skips a plugin that carries no skills instead of rejecting it (forest-docs is MCP-only)', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        // forest-docs is in FOREST_PLUGINS but ships no skills/ — that is normal, not an error.
        expect(FOREST_PLUGINS).toContain('forest-docs');
        expect(() => installSkills(root, false, null)).not.toThrow();
      });
    });

    it('throws when the bundle yields no skill at all (marketplace layout moved)', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        Object.keys(BUNDLE_SKILLS).forEach(plugin =>
          fs.rmSync(path.join(root, plugin, 'skills'), { recursive: true, force: true }),
        );
        expect(() => installSkills(root, false, null)).toThrow(
          /No skills found in the marketplace/,
        );
      });
    });

    it('never destroys a user file sitting where a skill dir belongs', () => {
      expect.assertions(3);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(SKILLS_DIR, { recursive: true });
        fs.writeFileSync(path.join(SKILLS_DIR, 'layout'), 'a file, not a dir — and mine');
        const { written, skipped } = installSkills(root, false, null);
        expect(fs.readFileSync(path.join(SKILLS_DIR, 'layout'), 'utf8')).toBe(
          'a file, not a dir — and mine',
        );
        expect(skipped).toContain(path.join(SKILLS_DIR, 'layout'));
        expect(written).not.toContain(layoutSkill);
      });
    });

    it('does not let --force overwrite files no previous run wrote', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(path.join(SKILLS_DIR, 'layout'), { recursive: true });
        fs.writeFileSync(layoutSkill, 'my own skill');
        // --force with NO previous manifest: nothing is managed, so nothing may be overwritten.
        const { skipped } = installSkills(root, true, null);
        expect(fs.readFileSync(layoutSkill, 'utf8')).toBe('my own skill');
        expect(skipped).toContain(layoutSkill);
      });
    });

    it('refuses to write through a symlinked ancestor of the skills dir', () => {
      expect.assertions(2);
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-outside-'));
      try {
        withTempDir(dir => {
          const root = fakeMarketplace(path.join(dir, 'src'));
          // `.agents` points elsewhere: mkdirSync -r would follow it and write outside the project.
          fs.symlinkSync(outside, '.agents');
          expect(() => installSkills(root, false, null)).toThrow(/symlinked directory/);
          expect(fs.readdirSync(outside)).toStrictEqual([]);
        });
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    it('refuses a symlinked <plugin>/skills root (crafted-marketplace ancestor escape)', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(path.join(dir, 'host', 'private'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'host', 'private', 'SKILL.md'), 'local secret');
        fs.rmSync(path.join(root, 'forest-code', 'skills'), { recursive: true, force: true });
        fs.symlinkSync(path.join(dir, 'host'), path.join(root, 'forest-code', 'skills'));
        const { written } = installSkills(root, false, null);
        expect(fs.existsSync(path.join(SKILLS_DIR, 'private'))).toBe(false);
        expect(written.every(f => !f.includes('private'))).toBe(true);
      });
    });

    it('ignores a stray directory that carries no SKILL.md', () => {
      expect.assertions(1);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(path.join(root, 'forest', 'skills', 'not-a-skill'), { recursive: true });
        installSkills(root, false, null);
        expect(fs.existsSync(path.join(SKILLS_DIR, 'not-a-skill'))).toBe(false);
      });
    });

    it('skips an already-installed skill unless force is set', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        const { written: first } = installSkills(root, false, null);
        fs.writeFileSync(layoutSkill, 'edited');
        installSkills(root, false, first); // no force → keep edit
        expect(fs.readFileSync(layoutSkill, 'utf8')).toBe('edited');
        installSkills(root, true, first); // force → overwrite a file we wrote before
        expect(fs.readFileSync(layoutSkill, 'utf8')).toBe('# layout skill');
      });
    });

    it('claims nothing on a first run over a pre-existing user skill dir', () => {
      expect.assertions(2);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(path.join(SKILLS_DIR, 'layout'), { recursive: true });
        fs.writeFileSync(layoutSkill, 'my own skill');
        const { written } = installSkills(root, false, null); // first run: no manifest
        expect(written).not.toContain(layoutSkill); // never recorded as managed…
        expect(fs.readFileSync(layoutSkill, 'utf8')).toBe('my own skill'); // …and untouched
      });
    });

    it('does not overwrite a user-authored file that collides with a bundle path, even with force', () => {
      expect.assertions(3);
      withTempDir(dir => {
        const root = fakeMarketplace(path.join(dir, 'src'));
        fs.mkdirSync(path.join(SKILLS_DIR, 'layout'), { recursive: true });
        fs.writeFileSync(layoutSkill, 'my own skill');
        // A previous run managed another skill, so the manifest exists but never claimed this file.
        const previous = [path.join(SKILLS_DIR, 'onboard', 'SKILL.md')];
        const { written, skipped } = installSkills(root, true, previous);
        expect(fs.readFileSync(layoutSkill, 'utf8')).toBe('my own skill');
        expect(skipped).toContain(layoutSkill);
        expect(written).not.toContain(layoutSkill);
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
        const { written } = copyDir('src-skill', 'dest');
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
        const { written } = copyDir('src-link', 'dest');
        expect(written).toStrictEqual([]); // nothing copied
        expect(fs.existsSync('dest/private.txt')).toBe(false); // host file not exfiltrated
      });
    });

    it('reports an unmanaged destination file as skipped instead of overwriting it', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('src-skill', { recursive: true });
        fs.writeFileSync('src-skill/SKILL.md', 'incoming');
        fs.mkdirSync('dest', { recursive: true });
        fs.writeFileSync('dest/SKILL.md', 'mine');
        const { written, skipped } = copyDir('src-skill', 'dest', () => false);
        expect(written).toStrictEqual([]);
        expect(skipped).toStrictEqual([path.join('dest', 'SKILL.md')]);
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

    it('writeManifest does not write through a symlinked .forest dir', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.mkdirSync('outside-dir');
        fs.symlinkSync(path.resolve('outside-dir'), '.forest');
        writeManifest({ ref: 'main', installedAt: 'x', agents: ['cursor'], files: [] });
        expect(fs.existsSync('outside-dir/skills-manifest.json')).toBe(false);
      });
    });
  });

  describe('skillDirEntries', () => {
    it('keeps only entries under the skills dir (normalized), dropping context files', () => {
      expect.assertions(1);
      expect(
        skillDirEntries([
          '.agents/skills/layout/SKILL.md',
          '.agents\\skills\\onboard\\SKILL.md', // windows-style separators
          'AGENTS.md',
          'CLAUDE.md',
        ]),
      ).toStrictEqual(['.agents/skills/layout/SKILL.md', '.agents\\skills\\onboard\\SKILL.md']);
    });
  });

  describe('removeStaleSkillFiles', () => {
    it('removes a previously-installed file that is gone upstream', () => {
      expect.assertions(2);
      withTempDir(() => {
        const stale = path.join(SKILLS_DIR, 'layout', 'stale.md');
        fs.mkdirSync(path.dirname(stale), { recursive: true });
        fs.writeFileSync(stale, 'old');
        const removed = removeStaleSkillFiles([stale], [path.join(SKILLS_DIR, 'layout/fresh.md')]);
        expect(removed).toStrictEqual([stale]);
        expect(fs.existsSync(stale)).toBe(false);
      });
    });

    it('keeps files still produced by the current run', () => {
      expect.assertions(2);
      withTempDir(() => {
        const kept = path.join(SKILLS_DIR, 'layout', 'SKILL.md');
        fs.mkdirSync(path.dirname(kept), { recursive: true });
        fs.writeFileSync(kept, 'current');
        const removed = removeStaleSkillFiles([kept], [kept]);
        expect(removed).toStrictEqual([]);
        expect(fs.existsSync(kept)).toBe(true);
      });
    });

    it('refuses a manifest entry escaping the skills dir via ..', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('victim.md', 'protected');
        const removed = removeStaleSkillFiles([path.join(SKILLS_DIR, '..', '..', 'victim.md')], []);
        expect(removed).toStrictEqual([]);
        expect(fs.existsSync('victim.md')).toBe(true);
      });
    });

    it('refuses to delete through a skill dir symlinked at another directory INSIDE the project', () => {
      expect.assertions(2);
      withTempDir(() => {
        // The classic near-miss: the link target stays under the project root, so a project-root
        // containment check would authorise deleting straight through it.
        fs.mkdirSync('src', { recursive: true });
        fs.writeFileSync('src/index.ts', 'application code');
        fs.mkdirSync(SKILLS_DIR, { recursive: true });
        fs.symlinkSync(path.resolve('src'), path.join(SKILLS_DIR, 'layout'));
        const removed = removeStaleSkillFiles([path.join(SKILLS_DIR, 'layout', 'index.ts')], []);
        expect(removed).toStrictEqual([]);
        expect(fs.readFileSync('src/index.ts', 'utf8')).toBe('application code');
      });
    });

    it('prunes an entry written with Windows separators when running on Unix', () => {
      expect.assertions(2);
      withTempDir(() => {
        const stale = path.join(SKILLS_DIR, 'layout', 'stale.md');
        fs.mkdirSync(path.dirname(stale), { recursive: true });
        fs.writeFileSync(stale, 'old');
        // A manifest written on Windows: comparing on normalized paths is not enough, the
        // existence check and the deletion must act on the normalized form too.
        const removed = removeStaleSkillFiles(['.agents\\skills\\layout\\stale.md'], []);
        expect(removed).toStrictEqual([stale]);
        expect(fs.existsSync(stale)).toBe(false);
      });
    });

    it('refuses to delete through a symlinked skills dir pointing outside the project', () => {
      expect.assertions(2);
      // The link target must live OUTSIDE the project root, or it is legitimately in scope.
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-outside-'));
      const victim = path.join(outside, 'victim.md');
      fs.writeFileSync(victim, 'protected');
      try {
        withTempDir(() => {
          fs.mkdirSync(path.dirname(SKILLS_DIR), { recursive: true });
          fs.symlinkSync(outside, SKILLS_DIR);
          const removed = removeStaleSkillFiles([path.join(SKILLS_DIR, 'victim.md')], []);
          expect(removed).toStrictEqual([]);
          expect(fs.existsSync(victim)).toBe(true);
        });
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    it('ignores manifest entries that no longer exist on disk', () => {
      expect.assertions(1);
      withTempDir(() => {
        expect(removeStaleSkillFiles([path.join(SKILLS_DIR, 'ghost.md')], [])).toStrictEqual([]);
      });
    });
  });

  describe('plugin route', () => {
    it('adds the marketplace at project scope then installs every Forest plugin (Claude Code)', () => {
      expect.assertions(3);
      mockCli();
      const { installed, failed } = installPlugins('claude');
      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'marketplace', 'add', MARKETPLACE_REPO, '--scope', 'project'],
        expect.anything(),
      );
      expect(installed).toStrictEqual(FOREST_PLUGINS);
      expect(failed).toStrictEqual([]);
    });

    it('uses codex own verbs (`plugin add`, no project scope) and passes a non-default ref', () => {
      expect.assertions(2);
      mockCli();
      installPlugins('codex', 'v1.2.3');
      expect(spawnSync).toHaveBeenCalledWith(
        'codex',
        ['plugin', 'marketplace', 'add', MARKETPLACE_REPO, '--ref', 'v1.2.3'],
        expect.anything(),
      );
      expect(spawnSync).toHaveBeenCalledWith(
        'codex',
        ['plugin', 'add', `${FOREST_PLUGINS[0]}@forest-admin-ai`, '--json'],
        expect.anything(),
      );
    });

    it('pins Claude Code to a non-default ref via the git-URL form', () => {
      expect.assertions(1);
      mockCli();
      installPlugins('claude', 'v1.2.3');
      expect(spawnSync).toHaveBeenCalledWith(
        'claude',
        [
          'plugin',
          'marketplace',
          'add',
          `https://github.com/${MARKETPLACE_REPO}.git#v1.2.3`,
          '--scope',
          'project',
        ],
        expect.anything(),
      );
    });

    it('throws without installing anything when the marketplace cannot be added', () => {
      expect.assertions(2);
      mockCli({ failing: /marketplace add/ });
      expect(() => installPlugins('claude')).toThrow(/marketplace add` failed/);
      expect(spawnSync).toHaveBeenCalledTimes(1); // no install attempted
    });

    it('reports a single failing plugin without losing the others', () => {
      expect.assertions(2);
      mockCli({ failing: new RegExp(`install ${FOREST_PLUGINS[1]}@`) });
      const { installed, failed } = installPlugins('claude');
      expect(failed).toStrictEqual([FOREST_PLUGINS[1]]);
      expect(installed).toStrictEqual([FOREST_PLUGINS[0], FOREST_PLUGINS[2]]);
    });

    it('reports a missing CLI rather than throwing', () => {
      expect.assertions(1);
      spawnSync.mockReset();
      spawnSync.mockReturnValue({ error: new Error('spawn claude ENOENT') });
      expect(hasPluginCli('claude')).toBe(false);
    });
  });

  describe('detectAgents', () => {
    it('detects agents from the marks they leave in a repo', () => {
      expect.assertions(2);
      mockCli({ failing: /--version/ }); // no agent CLI on this machine
      withTempDir(() => {
        fs.mkdirSync('.cursor');
        fs.writeFileSync('opencode.json', '{}');
        const detected = detectAgents();
        expect(detected).toContain('cursor');
        expect(detected).toContain('opencode');
      });
    });

    it('lets a repo signal win over an installed CLI, so a machine with every agent does not pre-check them all', () => {
      expect.assertions(1);
      mockCli(); // claude AND codex both answer --version on this machine
      withTempDir(() => {
        fs.mkdirSync('.cursor');
        // Only what this repo actually uses — not everything the developer happens to have.
        expect(detectAgents()).toStrictEqual(['cursor']);
      });
    });

    it('falls back to the installed CLIs when the repo carries no signal at all', () => {
      expect.assertions(1);
      mockCli();
      withTempDir(() => {
        expect(detectAgents()).toStrictEqual(['claude', 'codex']);
      });
    });

    it('returns nothing in a bare repo with no agent CLI installed', () => {
      expect.assertions(1);
      mockCli({ failing: /--version/ });
      withTempDir(() => {
        expect(detectAgents()).toStrictEqual([]);
      });
    });
  });

  describe('manifest', () => {
    it('round-trips ref, agents and files', () => {
      expect.assertions(1);
      withTempDir(() => {
        const manifest = {
          ref: 'main',
          installedAt: '2026-01-01T00:00:00.000Z',
          agents: ['claude', 'cursor'],
          files: [layoutSkill],
        };
        writeManifest(manifest);
        expect(readManifest()).toStrictEqual(manifest);
      });
    });

    it('reads a malformed manifest as absent rather than crashing callers', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('.forest', { recursive: true });
        fs.writeFileSync('.forest/skills-manifest.json', '{ not json');
        expect(readManifest()).toBeNull();
        fs.writeFileSync('.forest/skills-manifest.json', '{}'); // valid JSON, wrong shape
        expect(readManifest()).toBeNull();
      });
    });

    it('normalizes a non-array `agents` away so callers never call .filter on it', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.mkdirSync('.forest', { recursive: true });
        fs.writeFileSync(
          '.forest/skills-manifest.json',
          JSON.stringify({ ref: 'main', installedAt: 'x', agents: {}, files: [] }),
        );
        const manifest = readManifest();
        // Still a usable manifest — `files` is what makes it valid — with `agents` neutralised.
        expect(manifest?.files).toStrictEqual([]);
        expect(manifest?.agents).toBeUndefined();
      });
    });
  });
});
