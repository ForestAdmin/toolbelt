import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import superagent from 'superagent';
import * as tar from 'tar';

/**
 * Shared logic for `skills:init` / `skills:update`.
 *
 * Two distribution routes, because coding agents split in two families:
 *
 * - Agents with a native plugin system (Claude Code, Codex) → we drive THEIR CLI
 *   (`claude plugin …` / `codex plugin …`). They fetch, version, auto-update and wire the
 *   Forest docs MCP themselves, and the user gets the plugin's slash commands too. Nothing
 *   is copied into the repo.
 * - Agents that only discover `SKILL.md` files (Cursor, OpenCode, …) → we copy the same
 *   plugins' skills into `.agents/skills/`, the cross-agent convention they all read, so both
 *   routes deliver the same set.
 *
 * The marketplace repo is PUBLIC → no auth needed for the fetch, and both plugin CLIs read
 * the same `.claude-plugin/marketplace.json` (verified against codex-cli 0.147.0), so one
 * catalog serves every agent.
 */

export const MARKETPLACE_REPO = 'ForestAdmin/ai-marketplace';
export const MARKETPLACE_NAME = 'forest-admin-ai';

/**
 * The Forest plugins this command ships — the ONLY thing it decides, and it decides it once for
 * both routes. These three are what "knowing Forest" means: how to build a back-office (`forest`),
 * how to write agent code (`forest-code`), and how to look things up (`forest-docs`).
 *
 * `forest-mcp` is not one of them: it is a data-access server for querying a live project's
 * records, not help for the developer, so it has no place in a command whose job is to teach the
 * agent Forest. Anyone who wants it installs it themselves.
 *
 * Nothing below the plugin is filtered. There used to be a hand-picked list of skill NAMES, and it
 * did real damage: the plugin route installs whole plugins, so a name left out still shipped
 * there, and the skills cross-reference each other — `onboard` hands the production step to
 * `deploy-heroku`, which the list excluded — leaving copy-route users with an `onboard` skill
 * pointing at something never installed. A plugin is the unit of distribution and is coherent only
 * as a whole; what it contains is the marketplace's call, not ours. Choosing plugins is a product
 * decision, choosing their contents is drift waiting to happen.
 */
export const FOREST_PLUGINS = ['forest', 'forest-code', 'forest-docs'];

/**
 * The single skills dir on the copy route. `.agents/skills/` is the cross-agent convention:
 * Cursor and OpenCode both read it (alongside their own `.cursor/`, `.opencode/`), and so does
 * Codex. Claude Code is the one agent that does NOT read it — it reads `.claude/skills/` — but
 * it is served by the plugin route, so a second copy would only duplicate its skills.
 */
export const SKILLS_DIR = '.agents/skills';

/** Agents served by driving their own plugin CLI. */
export const PLUGIN_AGENTS = ['claude', 'codex'] as const;
/** Agents served by copying SKILL.md files into SKILLS_DIR. */
export const COPY_AGENTS = ['cursor', 'opencode', 'other'] as const;
export const ALL_AGENTS = [...PLUGIN_AGENTS, ...COPY_AGENTS] as const;

export type PluginAgent = (typeof PLUGIN_AGENTS)[number];
export type Agent = (typeof ALL_AGENTS)[number];

export const AGENT_LABELS: Record<Agent, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  opencode: 'OpenCode',
  other: 'Other (any SKILL.md-compatible agent)',
};

export const isPluginAgent = (agent: string): agent is PluginAgent =>
  (PLUGIN_AGENTS as readonly string[]).includes(agent);

export const MANIFEST_PATH = '.forest/skills-manifest.json';

const BLOCK_BEGIN = '<!-- forest:begin -->';
const BLOCK_END = '<!-- forest:end -->';

/** Context files, per agent. AGENTS.md is the cross-agent standard (Codex, Cursor, OpenCode). */
export function contextFileFor(agent: Agent): string {
  return agent === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
}

/**
 * The Forest block merged into a context file, describing every route that feeds THAT file.
 *
 * Takes the agents rather than one agent because a single file often serves both routes: AGENTS.md
 * is Codex's (plugin) and Cursor's and OpenCode's (copy). Writing one block per agent would have
 * the second merge replace the first — same delimiters — leaving the file describing only whichever
 * route ran last.
 */
export function forestBlock(agents: Agent[]): string {
  const where: string[] = [];
  if (agents.some(isPluginAgent))
    where.push(
      'available through the `forest` plugin — e.g. `/forest:start`, `/forest:layout`, `/forest-code`',
    );
  if (agents.some(agent => !isPluginAgent(agent)))
    where.push(`installed in \`${SKILLS_DIR}/\` — e.g. \`layout\`, \`onboard\`, \`forest-code\``);

  return [
    `This project uses **Forest Admin**. Skills to build and customize it are ${where.join(
      ', and ',
    )}.`,
    'Forest documentation is searchable via the `forest-docs` MCP server.',
  ].join('\n');
}

/** Group agents by the context file they write to, so each file gets exactly one merged block. */
export function contextFileGroups(agents: Agent[]): Map<string, Agent[]> {
  return agents.reduce((groups, agent) => {
    const file = contextFileFor(agent);
    groups.set(file, [...(groups.get(file) ?? []), agent]);

    return groups;
  }, new Map<string, Agent[]>());
}

export type Manifest = {
  ref: string;
  installedAt: string;
  /** Absent on manifests written before the field existed — those are copy-route installs. */
  agents?: string[];
  files: string[];
};

/**
 * Download + extract the marketplace tarball at `ref`. Returns the extracted root dir and a
 * `cleanup` the caller must run (in a finally) to delete the temp dir — otherwise every
 * init/update leaks a full copy of the marketplace under the OS temp dir.
 *
 * Only the copy route needs this: the plugin CLIs do their own fetching.
 */
export async function fetchMarketplace(
  ref = 'main',
): Promise<{ root: string; cleanup: () => void }> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-skills-'));
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  try {
    // Generic archive path (not `refs/heads/…`) so `ref` accepts branches, tags, and SHAs alike.
    const url = `https://codeload.github.com/${MARKETPLACE_REPO}/tar.gz/${ref}`;
    let res;
    try {
      res = await superagent
        .get(url)
        .timeout({ response: 15000, deadline: 30000 }) // don't hang forever on a stalled connection
        .responseType('blob');
    } catch (err) {
      if (err.status === 404) {
        throw new Error(
          `Forest marketplace ref "${ref}" not found in ${MARKETPLACE_REPO}. Check the --ref value.`,
        );
      }
      if (err.timeout)
        throw new Error(
          'Timed out reaching the Forest marketplace — check your connection and retry.',
        );
      throw new Error(
        `Could not fetch the Forest marketplace (${MARKETPLACE_REPO}): ${err.message}`,
      );
    }
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

/** Forward-slash-normalize a path so entries written on one OS (Windows `\`) compare equal to
 *  paths produced on another (Unix `/`). */
const normalizePath = (p: string) => p.replace(/\\/g, '/');

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

/**
 * Refuse to write anywhere below a symlinked ancestor. Checking the destination itself is not
 * enough: `mkdirSync(..., { recursive: true })` happily follows a symlinked `.agents` or
 * `.agents/skills`, and every file then lands outside the project. Walks relative segments only,
 * so it stops at `.` and never judges the absolute path the project happens to live under.
 */
function assertNoSymlinkedAncestor(target: string): void {
  for (
    let parent = path.dirname(target);
    parent !== path.dirname(parent);
    parent = path.dirname(parent)
  ) {
    if (isSymlink(parent)) {
      throw new Error(
        `Refusing to write through the symlinked directory "${parent}" — it points outside the ` +
          'files this command manages. Replace it with a real directory, then re-run.',
      );
    }
  }
}

/** Recursively list the files under `dir` (dest paths), mirroring copyDir's return without copying. */
function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);

    return entry.isDirectory() ? listFiles(p) : [p];
  });
}

/** The skill directories a plugin ships: every subdirectory holding a SKILL.md. A symlinked entry
 *  is ignored — copyDir would refuse it anyway, and it must not fabricate a dest dir. */
function listSkillDirs(skillsRoot: string): string[] {
  // The ancestor, not just the entries: `copyDir` checks whether a SKILL dir is a symlink, but a
  // crafted marketplace can symlink `<plugin>/skills` itself at an arbitrary local directory and
  // have every real child underneath copied in. Refuse the whole root.
  if (isSymlink(skillsRoot)) return [];

  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter(
      entry => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')),
    )
    .map(entry => entry.name);
}

/** What a copy produced: files we wrote, and files we refused to overwrite because the user
 *  wrote them (same path as a bundle file, but never managed by us). */
export type CopyResult = { written: string[]; skipped: string[] };

const emptyCopy = (): CopyResult => ({ written: [], skipped: [] });

const mergeCopy = (results: CopyResult[]): CopyResult => ({
  written: results.flatMap(r => r.written),
  skipped: results.flatMap(r => r.skipped),
});

/**
 * Recursively copy a directory. Never follows a symlink at the destination — it's replaced — so a
 * planted link can't redirect a write outside the project.
 *
 * `isManaged` decides whether an EXISTING destination file may be overwritten. A file that is on
 * disk but was never written by us is user-authored content that happens to share a bundle path:
 * we leave it alone and report it, rather than silently destroying it.
 */
export function copyDir(
  src: string,
  dest: string,
  isManaged: (file: string) => boolean = () => true,
): CopyResult {
  // Refuse a source dir that is itself a symlink — a crafted marketplace could point a curated
  // skill path at an absolute host dir and have readdirSync follow it, copying local files in.
  if (isSymlink(src)) return emptyCopy();
  if (isSymlink(dest)) fs.rmSync(dest);
  fs.mkdirSync(dest, { recursive: true });

  return mergeCopy(
    fs.readdirSync(src, { withFileTypes: true }).map(entry => {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      // Never follow a symlink in the source bundle (a crafted marketplace could point one at an
      // arbitrary file on the user's machine and have us copy its contents in).
      if (entry.isSymbolicLink()) return emptyCopy();
      if (entry.isDirectory()) return copyDir(from, to, isManaged);
      // Existing file we never wrote → the user's. Don't clobber it.
      if (fs.existsSync(to) && !isSymlink(to) && !isManaged(to))
        return { written: [], skipped: [to] };
      if (isSymlink(to)) fs.rmSync(to);
      fs.copyFileSync(from, to);

      return { written: [to], skipped: [] };
    }),
  );
}

/** Install one skill directory. Split out of `installSkills` so each function stays readable. */
function installSkill(
  src: string,
  dest: string,
  force: boolean,
  isManaged: (file: string) => boolean,
): CopyResult {
  if (fs.existsSync(dest)) {
    if (!fs.lstatSync(dest).isDirectory()) {
      // Something that is not a directory sits where a skill dir belongs. We did not put it there
      // — a skill is always a directory — so it is the user's, and removing it to make room would
      // destroy content no manifest ever claimed. Report it and move on.
      return { written: [], skipped: [dest] };
    }
    if (!force) {
      // Installed and no --force: nothing is written here, so only carry over files that are BOTH
      // in the incoming bundle (derived from source, mapped to dest — never the actual dir
      // contents, which may include user-added files) AND in the previous manifest (proof a past
      // run wrote them). A dir that pre-existed the first run was authored by the user: claiming
      // its files would mark them managed and a later refresh would prune them.
      return {
        written: listFiles(src)
          .map(f => path.join(dest, path.relative(src, f)))
          .filter(isManaged),
        skipped: [],
      };
    }
    // With --force on an existing dir we fall through and overlay the incoming bundle on top. We
    // deliberately do NOT delete the dir, so user-added files survive; pruning of Forest-owned
    // files that left the bundle is the command's job (removeStaleSkillFiles, manifest-scoped).
  }

  // `isManaged` is the only licence to overwrite, --force included: the flag re-writes what a
  // previous run wrote, it does not claim the right to destroy files we never wrote. With no
  // previous manifest nothing is managed, so a forced re-install over a directory the user authored
  // overwrites none of it. New files are unaffected — the guard only sees paths already on disk.
  return copyDir(src, dest, isManaged);
}

/**
 * Copy the skills of every shipped plugin from the extracted repo into `SKILLS_DIR`.
 *
 * The same `FOREST_PLUGINS` the plugin route installs — one list, so the two routes cannot drift.
 * A plugin with no `skills/` is simply skipped rather than rejected: `forest-docs` legitimately
 * carries only an MCP config, which this route cannot wire anyway. What must not pass silently is
 * copying NOTHING, so that is what the guard checks — a marketplace whose layout moved under us.
 *
 * `previousFiles` is the file list from the previous manifest (`null` on a first run). It bounds
 * what we may claim as managed AND what we may overwrite: a file we never wrote is the user's,
 * both on the skip path (claiming it would let a later prune delete it) and on the force path
 * (overwriting it would destroy it outright).
 */
export function installSkills(
  srcRoot: string,
  force: boolean,
  previousFiles: string[] | null,
): CopyResult {
  const previouslyManaged = new Set((previousFiles ?? []).map(normalizePath));
  const isManaged = (file: string) => previouslyManaged.has(normalizePath(file));

  // Before ANY write: a symlinked `.agents` or `.agents/skills` would send every copy outside the
  // project. Checked once here so the run aborts whole rather than half-applied.
  assertNoSymlinkedAncestor(path.join(SKILLS_DIR, 'x'));

  const result = mergeCopy(
    FOREST_PLUGINS.flatMap(plugin => {
      const skillsRoot = path.join(srcRoot, plugin, 'skills');
      if (!fs.existsSync(skillsRoot)) return [];

      return listSkillDirs(skillsRoot).map(skill =>
        installSkill(path.join(skillsRoot, skill), path.join(SKILLS_DIR, skill), force, isManaged),
      );
    }),
  );

  if (!result.written.length && !result.skipped.length) {
    throw new Error(
      `No skills found in the marketplace for ${FOREST_PLUGINS.join(', ')} (expected ` +
        '`<plugin>/skills/<name>/SKILL.md`). The marketplace layout changed — check the --ref value.',
    );
  }

  return result;
}

/** From a manifest file list, the entries that live under the skills dir (normalized for Windows,
 *  where manifest paths use backslashes). These are the candidates for stale-pruning on a refresh. */
export function skillDirEntries(files: string[]): string[] {
  return files.filter(file => normalizePath(file).startsWith(SKILLS_DIR));
}

/** Guard a deletion candidate: it must resolve *inside* the skills dir (blocks `..` traversal and
 *  absolute paths) and its real location must stay there too (blocks a symlinked ancestor from
 *  redirecting the delete outside the project). A crafted manifest entry must never widen rmSync. */
function isWithinSkillDirs(file: string): boolean {
  const base = path.resolve(SKILLS_DIR);
  const resolved = path.resolve(file);
  // Textual containment: reject `..` traversal and absolute paths outside the skills dir.
  if (!resolved.startsWith(base + path.sep)) return false;
  // Real containment against the real skills dir — NOT merely the project root. A skill
  // subdirectory symlinked at, say, `src/` keeps its target inside the project, so a project-root
  // check would happily authorise deleting `src/index.ts` through it. The skills dir itself must
  // also resolve inside the project, or a link pointing outside would whitelist everything below.
  try {
    const projectRoot = fs.realpathSync(process.cwd());
    const realSkillsDir = fs.realpathSync(SKILLS_DIR);
    const realParent = fs.realpathSync(path.dirname(file));
    const isUnder = (child: string, root: string) =>
      child === root || child.startsWith(root + path.sep);

    return isUnder(realSkillsDir, projectRoot) && isUnder(realParent, realSkillsDir);
  } catch {
    return false; // path doesn't resolve (already gone) → nothing to delete
  }
}

/**
 * Delete managed skill files that existed before but are no longer produced (removed upstream).
 * Set-diff of previous vs current, deleting only paths that still exist *and* are safely contained
 * within the skills dir. Returns what it removed.
 */
export function removeStaleSkillFiles(previousFiles: string[], currentFiles: string[]): string[] {
  // Work on forward-slash-normalized paths throughout, not just for the comparison: a manifest
  // written on Windows carries `.agents\skills\…`, which `existsSync` and `rmSync` do not resolve
  // on Unix, so a normalized-comparison-only version silently pruned nothing. Node accepts forward
  // slashes on Windows too, so the normalized form is safe to act on everywhere.
  const kept = new Set(currentFiles.map(normalizePath));
  const stale = previousFiles
    .map(normalizePath)
    .filter(file => !kept.has(file) && fs.existsSync(file) && isWithinSkillDirs(file));
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

// ---------------------------------------------------------------------------------------------
// Plugin route: drive the agent's own CLI
// ---------------------------------------------------------------------------------------------

const PLUGIN_BINS: Record<PluginAgent, string> = { claude: 'claude', codex: 'codex' };

/** Run an agent CLI and return its outcome. Never throws on a non-zero exit — callers decide. */
function runCli(bin: string, args: string[]): { ok: boolean; output: string } {
  const res = spawnSync(bin, args, { encoding: 'utf8' });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.error) return { ok: false, output: res.error.message };

  return { ok: res.status === 0, output };
}

/** True if the agent's CLI is installed and runnable. */
export function hasPluginCli(agent: PluginAgent): boolean {
  return runCli(PLUGIN_BINS[agent], ['--version']).ok;
}

/**
 * Marketplace source for an agent CLI. Both read the same `.claude-plugin/marketplace.json`.
 * A non-default ref is passed the way each CLI accepts it: Codex has `--ref`, Claude Code takes
 * it appended to a full git URL (`....git#ref`) since the `owner/repo` shorthand has no ref form.
 */
function marketplaceAddArgs(agent: PluginAgent, ref: string): string[] {
  if (agent === 'codex') {
    return [
      'plugin',
      'marketplace',
      'add',
      MARKETPLACE_REPO,
      ...(ref === 'main' ? [] : ['--ref', ref]),
    ];
  }
  const source =
    ref === 'main' ? MARKETPLACE_REPO : `https://github.com/${MARKETPLACE_REPO}.git#${ref}`;

  return ['plugin', 'marketplace', 'add', source, '--scope', 'project'];
}

/**
 * `install` on Claude Code (project scope → the plugin is declared in `.claude/settings.json`,
 * which the team commits), `add` on Codex (user scope only — its CLI has no project scope).
 */
function pluginInstallArgs(agent: PluginAgent, plugin: string): string[] {
  return agent === 'codex'
    ? ['plugin', 'add', `${plugin}@${MARKETPLACE_NAME}`, '--json']
    : ['plugin', 'install', `${plugin}@${MARKETPLACE_NAME}`, '--scope', 'project'];
}

export type PluginInstallResult = { agent: PluginAgent; installed: string[]; failed: string[] };

/**
 * Register the Forest marketplace with the agent's CLI and install the Forest plugins.
 * Throws when the marketplace cannot be added at all (nothing else can work); a single plugin
 * that fails to install is reported, not fatal — the others are still worth having.
 */
export function installPlugins(agent: PluginAgent, ref = 'main'): PluginInstallResult {
  const bin = PLUGIN_BINS[agent];
  const added = runCli(bin, marketplaceAddArgs(agent, ref));
  if (!added.ok) {
    throw new Error(
      `\`${bin} plugin marketplace add\` failed: ${added.output || 'unknown error'}. ` +
        'Nothing was changed for this agent.',
    );
  }

  const installed: string[] = [];
  const failed: string[] = [];
  FOREST_PLUGINS.forEach(plugin => {
    if (runCli(bin, pluginInstallArgs(agent, plugin)).ok) installed.push(plugin);
    else failed.push(plugin);
  });

  return { agent, installed, failed };
}

/** Refresh already-installed plugins (the plugin-route equivalent of re-copying files). */
export function upgradePlugins(agent: PluginAgent, ref = 'main'): PluginInstallResult {
  // Both CLIs are idempotent on add/install, and re-running them is the one path that works the
  // same whether the plugin is present, stale, or was removed by hand.
  return installPlugins(agent, ref);
}

// ---------------------------------------------------------------------------------------------
// Agent detection
// ---------------------------------------------------------------------------------------------

/** Marks an agent leaves in a repo it is actually used on. */
const REPO_SIGNALS: Record<Agent, string[]> = {
  claude: ['.claude', 'CLAUDE.md'],
  codex: ['.codex'],
  cursor: ['.cursor', '.cursorrules'],
  opencode: ['.opencode', 'opencode.json'],
  other: [],
};

/**
 * Best-effort guess of which agents THIS REPO uses, so the prompt comes pre-checked and `--agent`
 * stays optional in scripted runs. A missing signal is not an error: the user can always tick a
 * box or pass the flag.
 *
 * Repo signals win over an installed binary, and deliberately so: a developer who has every agent
 * CLI on their machine would otherwise get all of them pre-checked in every repo, and confirming
 * the prompt would install plugins they never asked for. The PATH is consulted only when the repo
 * says nothing at all — the fresh-project case (`npx create-forest`), where "what you have
 * installed" is the only signal there is.
 */
export function detectAgents(): Agent[] {
  const fromRepo = (ALL_AGENTS as readonly Agent[]).filter(agent =>
    REPO_SIGNALS[agent].some(mark => fs.existsSync(mark)),
  );
  if (fromRepo.length) return fromRepo;

  return (PLUGIN_AGENTS as readonly PluginAgent[]).filter(hasPluginCli);
}

export function readManifest(): Manifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    // Validate the shape: a valid-but-malformed manifest ({}, [], null…) must read as "absent",
    // otherwise callers dereference `previous.files` and crash.
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.files)) return null;

    // `agents` is normalized rather than required: a manifest predating the field is a legitimate
    // copy-route install that callers handle, but anything that is not an array (`{}`, a string)
    // must not reach their `.filter` — it would throw instead of degrading.
    return { ...parsed, agents: Array.isArray(parsed.agents) ? parsed.agents : undefined };
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
