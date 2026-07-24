import fs from 'fs';
import os from 'os';
import path from 'path';
import superagent from 'superagent';
import * as tar from 'tar';

/**
 * Shared logic for `skills:init` / `skills:update`: fetch the public
 * ForestAdmin/ai-marketplace repo, copy the Forest skill bundles into a project
 * (project-scoped, for Claude Code and Codex), merge a Forest block into
 * CLAUDE.md/AGENTS.md, wire the Forest docs MCP, and track it in a manifest.
 *
 * The marketplace repo is PUBLIC → no auth needed for the fetch.
 */

export const MARKETPLACE_REPO = 'ForestAdmin/ai-marketplace';

// Which dev-facing skills we distribute into a client's repo. Curated on purpose
// (explicit control over what ships; internal/test-only skills like deploy-heroku
// stay out). Source path in the repo = `<plugin>/skills/<name>`.
export const SKILL_SOURCES: { plugin: string; skills: string[] }[] = [
  {
    plugin: 'forest',
    skills: ['boot-standalone-agent', 'layout', 'management', 'onboard', 'workflows'],
  },
  { plugin: 'forest-code', skills: ['forest-code', 'forest-legacy'] },
];

// Per-agent project-scoped skill dir (both are auto-discovered; no marketplace needed).
export const AGENT_SKILL_DIRS: Record<string, string> = {
  claude: '.claude/skills',
  codex: '.agents/skills',
};

export const MANIFEST_PATH = '.forest/skills-manifest.json';

const BLOCK_BEGIN = '<!-- forest:begin -->';
const BLOCK_END = '<!-- forest:end -->';

// The Forest block merged into CLAUDE.md / AGENTS.md (project context for the agent).
export const FOREST_BLOCK = [
  'This project uses **Forest Admin**. Skills to build/customize it are installed in',
  '`.claude/skills/` (Claude Code) and `.agents/skills/` (Codex) — e.g. `/forest-code`, `/forest:layout`.',
  'Forest documentation is searchable via the `forest-docs` MCP server.',
].join('\n');

export type Manifest = { ref: string; installedAt: string; agents: string[]; files: string[] };

export function contextFileFor(agent: string): string {
  return agent === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
}

/**
 * Download + extract the marketplace tarball at `ref`. Returns the extracted root dir and a
 * `cleanup` the caller must run (in a finally) to delete the temp dir — otherwise every
 * init/update leaks a full copy of the marketplace under the OS temp dir.
 */
export async function fetchMarketplace(
  ref = 'main',
): Promise<{ root: string; cleanup: () => void }> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-skills-'));
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  try {
    // Generic archive path (not `refs/heads/…`) so `ref` accepts branches, tags, and SHAs alike.
    const url = `https://codeload.github.com/${MARKETPLACE_REPO}/tar.gz/${ref}`;
    const res = await superagent.get(url).responseType('blob');
    const tgz = path.join(tmp, 'marketplace.tar.gz');
    fs.writeFileSync(tgz, res.body as Buffer);
    await tar.x({ file: tgz, cwd: tmp });
    const root = fs.readdirSync(tmp).find(dir => dir.startsWith('ai-marketplace-'));
    if (!root) throw new Error('Could not extract the marketplace tarball.');

    return { root: path.join(tmp, root), cleanup };
  } catch (error) {
    cleanup(); // don't leak the temp dir when the fetch/extract fails
    throw error;
  }
}

/** True if `p` exists and is a symlink (never throws). */
function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Remove a symlink sitting at `p` so a following write/mkdir creates a real file/dir inside the
 *  project rather than following the link to overwrite something outside it. No-op otherwise. */
function replaceSymlink(p: string): void {
  if (isSymlink(p)) fs.rmSync(p);
}

/** Recursively list the files under `dir` (dest paths), mirroring copyDir's return without copying. */
function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);

    return entry.isDirectory() ? listFiles(p) : [p];
  });
}

/** Recursively copy a directory, returning the list of files written. Never follows a symlink at
 *  the destination — it's replaced — so a planted link can't redirect a write outside the project. */
export function copyDir(src: string, dest: string): string[] {
  if (isSymlink(dest)) fs.rmSync(dest);
  fs.mkdirSync(dest, { recursive: true });

  return fs.readdirSync(src, { withFileTypes: true }).flatMap(entry => {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) return copyDir(from, to);
    if (isSymlink(to)) fs.rmSync(to);
    fs.copyFileSync(from, to);

    return [to];
  });
}

/** Copy the skill bundles from the extracted repo into one agent's skills dir. */
export function installSkills(srcRoot: string, agent: string, force: boolean): string[] {
  const targetBase = AGENT_SKILL_DIRS[agent];

  return SKILL_SOURCES.flatMap(({ plugin, skills }) =>
    skills.flatMap(skill => {
      const src = path.join(srcRoot, plugin, 'skills', skill);
      const dest = path.join(targetBase, skill);
      // Fail loud on a missing curated skill rather than reporting a misleading partial success.
      if (!fs.existsSync(src)) {
        throw new Error(
          `Skill "${skill}" is missing from the marketplace (expected ${plugin}/skills/${skill}). ` +
            'The curated SKILL_SOURCES list is out of sync with this marketplace ref.',
        );
      }
      if (fs.existsSync(dest)) {
        if (!fs.lstatSync(dest).isDirectory()) {
          // A stray non-directory where a skill dir belongs → replace it wholesale.
          fs.rmSync(dest, { recursive: true, force: true });
        } else if (!force) {
          // Installed and no --force: keep as-is, but report the *managed* files (derived from the
          // source bundle, mapped to dest) so the manifest stays complete — NOT the actual dir
          // contents, which may include user-added files we must never record as managed (they'd
          // then be pruned on a later refresh).
          return listFiles(src).map(f => path.join(dest, path.relative(src, f)));
        }
        // With --force on an existing dir we fall through and overlay the incoming bundle on top.
        // We deliberately do NOT delete the dir, so user-added files survive; pruning of
        // Forest-owned files that left the bundle is the command's job (removeStaleSkillFiles,
        // manifest-scoped) — never a blind rm here.
      }

      return copyDir(src, dest);
    }),
  );
}

/** From a manifest file list, the entries that live under the skill dirs (normalized for Windows,
 *  where manifest paths use backslashes). These are the candidates for stale-pruning on a refresh. */
export function skillDirEntries(files: string[]): string[] {
  const bases = Object.values(AGENT_SKILL_DIRS);

  return files.filter(file => bases.some(dir => file.replace(/\\/g, '/').startsWith(dir)));
}

/** Guard a deletion candidate: it must resolve *inside* the skill dirs (blocks `..` traversal and
 *  absolute paths) and its real location must stay there too (blocks a symlinked ancestor from
 *  redirecting the delete outside the project). A crafted manifest entry must never widen rmSync. */
function isWithinSkillDirs(file: string): boolean {
  const skillBases = Object.values(AGENT_SKILL_DIRS).map(dir => path.resolve(dir));
  const resolved = path.resolve(file);
  // Textual containment: reject `..` traversal and absolute paths outside the skill dirs.
  if (!skillBases.some(base => resolved.startsWith(base + path.sep))) return false;
  // Real containment against the PROJECT root (not the skill dir's symlink target): a symlinked
  // skill dir pointing outside the project must be rejected, never whitelisted via its target.
  try {
    const projectRoot = fs.realpathSync(process.cwd());
    const realParent = fs.realpathSync(path.dirname(file));

    return realParent === projectRoot || realParent.startsWith(projectRoot + path.sep);
  } catch {
    return false; // path doesn't resolve (already gone) → nothing to delete
  }
}

/**
 * Delete managed skill files that existed before but are no longer produced (removed upstream).
 * Set-diff of previous vs current, deleting only paths that still exist *and* are safely contained
 * within the skill dirs. Returns what it removed.
 */
export function removeStaleSkillFiles(previousFiles: string[], currentFiles: string[]): string[] {
  // Compare on forward-slash-normalized paths so a manifest written on one OS (e.g. Unix `/`)
  // matches files produced on another (Windows `\`) — otherwise every entry looks stale and a
  // cross-platform refresh would wipe freshly-installed bundles. Delete via the original path.
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const kept = new Set(currentFiles.map(normalize));
  const stale = previousFiles.filter(
    file => !kept.has(normalize(file)) && fs.existsSync(file) && isWithinSkillDirs(file),
  );
  stale.forEach(file => fs.rmSync(file));

  return stale;
}

/** Merge a delimited Forest block into a context file (CLAUDE.md / AGENTS.md) without
 *  clobbering the user's own content. Creates the file if absent. */
export function mergeBlock(file: string, content: string): void {
  replaceSymlink(file); // never write through a symlinked context file
  const block = `${BLOCK_BEGIN}\n${content}\n${BLOCK_END}`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${block}\n`);

    return;
  }
  const current = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`${BLOCK_BEGIN}[\\s\\S]*?${BLOCK_END}`);
  const next = re.test(current) ? current.replace(re, block) : `${current.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(file, next);
}

/**
 * Wire the Forest docs MCP (Mintlify, https://docs.forest.app/mcp — static, read-only, NO secret)
 * by reading the source of truth `forest-docs/.mcp.json` from the fetched marketplace and merging
 * its `mcpServers` into the project's `.mcp.json` (preserving any existing servers the user has).
 */
export function installDocsMcp(srcRoot: string): string {
  const incoming = JSON.parse(
    fs.readFileSync(path.join(srcRoot, 'forest-docs', '.mcp.json'), 'utf8'),
  );
  const target = '.mcp.json';
  replaceSymlink(target); // never read/write through a symlinked .mcp.json
  let current: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
  if (fs.existsSync(target)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
      // Valid JSON that isn't a plain object (null, array, scalar) → treat as empty, don't crash.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        current = parsed as { mcpServers?: Record<string, unknown> };
      }
    } catch {
      // Don't clobber a user-authored (but unparseable) config with an empty one.
      throw new Error(
        `Cannot parse existing ${target}; aborting so it isn't overwritten. Fix or remove it, then re-run.`,
      );
    }
  }
  current.mcpServers = { ...(current.mcpServers || {}), ...(incoming.mcpServers || {}) };
  fs.writeFileSync(target, `${JSON.stringify(current, null, 2)}\n`);

  return target;
}

export function readManifest(): Manifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    // Validate the shape: a valid-but-malformed manifest ({}, [], null…) must read as "absent",
    // otherwise callers dereference `previous.files` and crash.
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) return parsed;

    return null;
  } catch {
    return null;
  }
}

export function writeManifest(manifest: Manifest): void {
  const dir = path.dirname(MANIFEST_PATH);
  replaceSymlink(dir); // don't let a symlinked .forest redirect the write outside the project
  fs.mkdirSync(dir, { recursive: true });
  replaceSymlink(MANIFEST_PATH);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}
