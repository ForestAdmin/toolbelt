import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { SPRITE_WIDTH, mascotEnabled, mascotRows, menuKeys, menuMove } from './mascot';

/**
 * The `forest start` screen: a header box, a live checklist of steps, then a summary.
 *
 * Child output (npm, `forest` sub-commands, the agent) never reaches the terminal here. It goes to
 * a log file, and only its last line is shown under the running step. On a failure the tail of
 * that log is printed, so nothing is hidden when it matters.
 *
 * In rich mode the Forest beaver (mascot.ts) runs over the progress bar while a step loads, and
 * breathes over the end menu.
 *
 * Rich mode redraws in place and needs a TTY. Plain mode prints one line per event, for CI logs
 * and terminals that cannot move the cursor.
 */

// Forest Admin Design System, dark theme.
export const colors = {
  accent: chalk.hex('#ddf327'),
  success: chalk.hex('#71d083'),
  warning: chalk.hex('#ffa057'),
  danger: chalk.hex('#f47b53'),
  info: chalk.hex('#70b8ff'),
  ai: chalk.hex('#d19dff'),
  muted: chalk.hex('#a5a7a2'),
  bold: chalk.bold,
};

// The forest.app mark (two chevrons over a trunk), traced from its SVG in half-block characters,
// beside "FOREST" in the same block style.
const TREE = [
  '      ▄▄     ',
  '    ▄████▄   ',
  '  ▄██▀  ▀██▄ ',
  ' ██▀  ▄▄  ▀██',
  '    ▄████▄   ',
  '  ▄██▀██▀██▄ ',
  ' ██▀  ██  ▀██',
  '      ██     ',
  '      ██     ',
];
const WORDMARK = ['█▀▀ █▀█ █▀█ █▀▀ █▀▀ ▀█▀', '█▀  █ █ █▀▄ █▀▀ ▀▀█  █ ', '▀   ▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀  ▀ '];
// The wordmark fades from the accent to the success green, top to bottom.
const LOGO_FROM = [0xdd, 0xf3, 0x27];
const LOGO_TO = [0x71, 0xd0, 0x83];
// The progress bar's own line, also the beaver's track.
const BAR_MAX = 72;

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 80;
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

type StepState = 'pending' | 'active' | 'done' | 'warned' | 'failed';

export type StepDef = { id: string; label: string; why?: string };

type Step = StepDef & {
  state: StepState;
  startedAt?: number;
  ms?: number;
  detail?: string;
  lastLine?: string;
};

export type MenuChoice = { name: string; value: string };

type Menu = { message: string; choices: MenuChoice[]; index: number };

export type StepContext = {
  /** Record one line of child output: to the log file, and as the step's last line. */
  log: (line: string) => void;
  /** Short text shown after the label once the step is done. */
  detail: (text: string) => void;
  /** Finish this step with a warning (orange) instead of a tick. */
  warn: (text: string) => void;
};

const visibleLength = (text: string) => text.replace(ANSI, '').length;

/** Cut a line to the terminal width, so a redraw never wraps and miscounts its own height. */
function clip(text: string, width: number): string {
  if (visibleLength(text) <= width) return text;

  const plain = text.replace(ANSI, '');

  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  text.split(/\s+/).forEach(word => {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  });
  if (line) lines.push(line);

  return lines;
}

function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  return `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(
    2,
    '0',
  )}s`;
}

function blend(from: number[], to: number[], ratio: number): string {
  const hex = from
    .map((value, index) => Math.round(value + (to[index] - value) * ratio))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');

  return `#${hex}`;
}

/** `━━━━━━────` filled to `done / total`, in the accent colour. */
function progressBar(done: number, total: number, width: number): string {
  const filled = total ? Math.round((done / total) * width) : 0;

  return `${colors.accent('━'.repeat(filled))}${colors.muted('─'.repeat(width - filled))}`;
}

export default class OnboardingUI {
  readonly rich: boolean;

  readonly logFile: string;

  private steps: Step[] = [];

  private title = '';

  private subtitle = '';

  private startedAt = Date.now();

  private height = 0;

  private frame = 0;

  private timer?: NodeJS.Timeout;

  private stream: NodeJS.WriteStream = process.stdout;

  private stdin: NodeJS.ReadStream = process.stdin;

  /** When the last step ended: the "ready in" time stops there while the region lives on. */
  private endedAt?: number;

  /** A region is on screen and redrawn in place. */
  private live = false;

  /** The checklist is part of that region (a later menu draws without it). */
  private checklistLive = false;

  /** Banner, status and notes printed while the region is live, drawn under the checklist. */
  private after: string[] = [];

  private menu?: Menu;

  private onKeys?: (data: Buffer) => void;

  private lastFrame = '';

  /** The beaver's clock. */
  private readonly bornAt = Date.now();

  // A hidden cursor or a raw stdin outliving the CLI breaks the user's shell, so both are undone
  // on the way out. Ctrl-C is re-raised once the terminal is back, for the usual handlers.
  private readonly restoreOnExit = () => this.restoreTerminal();

  private readonly restoreOnSigint = () => {
    this.release();
    process.kill(process.pid, 'SIGINT');
  };

  constructor({ rich, logName = 'forest-start' }: { rich: boolean; logName?: string }) {
    this.rich = rich && Boolean(process.stdout.isTTY);
    this.logFile = path.join(os.tmpdir(), `${logName}-${Date.now()}.log`);
  }

  private get width(): number {
    return Math.max(40, (this.stream.columns || 80) - 2);
  }

  /** The progress bar's width, which is also the beaver's track. */
  private get barWidth(): number {
    return Math.max(10, Math.min((this.stream.columns || 80) - 4, BAR_MAX));
  }

  private write(text: string) {
    this.stream.write(text);
  }

  /** Write below the screen so far, or into the region while it is live, so frames keep it. */
  private print(text: string) {
    if (!this.live) {
      this.write(text);

      return;
    }

    this.after.push(...text.replace(/\n$/, '').split('\n'));
    this.render();
  }

  private appendLog(line: string) {
    try {
      // Only its user may read it: the temp folder is shared on Linux.
      fs.appendFileSync(this.logFile, `${line}\n`, { mode: 0o600 });
    } catch {
      // A log we cannot write must never stop the onboarding.
    }
  }

  // ---------- header ----------

  /** The tree, the FOREST wordmark and a tagline. Skipped on narrow terminals, where it would wrap. */
  logo(tagline: string): void {
    const indent = `  ${' '.repeat(TREE[0].length)}  `;
    if (!this.rich || this.width < indent.length + WORDMARK[0].length) return;
    const word = WORDMARK.map((line, index) =>
      chalk.hex(blend(LOGO_FROM, LOGO_TO, index / (WORDMARK.length - 1)))(line),
    );
    const right = ['', '', ...word, '', colors.muted(clip(tagline, this.width - indent.length))];
    const lines = TREE.map((line, index) => `  ${colors.accent(line)}  ${right[index] ?? ''}`);
    this.write(`\n${lines.join('\n')}\n`);
  }

  /** The box at the top of the screen. */
  header(lines: string[]): void {
    const inner = Math.min(this.width - 4, 76);
    const top = colors.accent(`╭${'─'.repeat(inner + 2)}╮`);
    const bottom = colors.accent(`╰${'─'.repeat(inner + 2)}╯`);
    const body = lines.map(line => {
      const cut = clip(line, inner);

      return `${colors.accent('│')} ${cut}${' '.repeat(inner - visibleLength(cut))} ${colors.accent(
        '│',
      )}`;
    });

    this.print(`\n${[top, ...body, bottom].join('\n')}\n`);
  }

  // ---------- checklist ----------

  plan(title: string, subtitle: string, steps: StepDef[]): void {
    this.title = title;
    this.subtitle = subtitle;
    this.steps = steps.map(step => ({ ...step, state: 'pending' }));
    this.startedAt = Date.now();

    if (this.rich) {
      this.write('\n');
      this.goLive(true);
      this.render();
    } else {
      this.write(`\n${title} · ${subtitle}\n`);
    }
  }

  /** Run one planned step, showing it as active until `work` settles. */
  async run<T>(id: string, work: (context: StepContext) => Promise<T>): Promise<T> {
    const step = this.steps.find(candidate => candidate.id === id);
    if (!step) throw new Error(`Unknown onboarding step: ${id}`);

    step.state = 'active';
    step.startedAt = Date.now();
    this.appendLog(`\n=== ${step.label} ===`);
    if (this.rich) this.startTicking();
    else this.write(`${colors.muted('→')} ${step.label}…\n`);

    const context: StepContext = {
      log: line => {
        const clean = line.replace(ANSI, '').trim();
        if (!clean) return;
        this.appendLog(clean);
        step.lastLine = clean;
      },
      detail: text => {
        step.detail = text;
      },
      warn: text => {
        step.detail = text;
        step.state = 'warned';
      },
    };

    try {
      const result = await work(context);
      step.ms = Date.now() - (step.startedAt as number);
      if (step.state === 'active') step.state = 'done';

      return result;
    } catch (error) {
      step.ms = Date.now() - (step.startedAt as number);
      step.state = 'failed';
      [step.detail] = (error as Error).message.split('\n');
      throw error;
    } finally {
      if (this.steps.every(candidate => ['done', 'warned'].includes(candidate.state))) {
        this.endedAt = Date.now();
      }
      if (this.rich) {
        this.stopTicking();
        this.render();
      } else {
        this.write(`${this.stepLine(step)}\n`);
      }
    }
  }

  /** Append to the log without touching the screen: output that arrives after its step. */
  record(line: string): void {
    const clean = line.replace(ANSI, '').trim();
    if (clean) this.appendLog(clean);
  }

  /** The last lines of the log, for a failure message. */
  logTail(count = 15): string[] {
    try {
      return fs.readFileSync(this.logFile, 'utf8').trim().split('\n').slice(-count);
    } catch {
      return [];
    }
  }

  private startTicking() {
    this.stopTicking();
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER.length;
      this.render();
    }, FRAME_MS);
  }

  private stopTicking() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private stepLine(step: Step): string {
    const icon = {
      pending: colors.muted('○'),
      active: colors.accent(SPINNER[this.frame]),
      done: colors.success('✓'),
      warned: colors.warning('!'),
      failed: colors.danger('✗'),
    }[step.state];
    const label = step.state === 'pending' ? colors.muted(step.label) : step.label;
    const detail = step.detail ? colors.muted(` · ${step.detail}`) : '';
    const elapsed =
      step.state === 'active' ? Date.now() - (step.startedAt as number) : step.ms ?? undefined;
    const time = elapsed !== undefined ? colors.muted(duration(elapsed)) : '';
    const left = clip(`  ${icon} ${label}${detail}`, this.width - 10);
    const gap = Math.max(1, this.width - visibleLength(left) - visibleLength(time));

    return `${left}${' '.repeat(gap)}${time}`;
  }

  /** The checklist: title with counts and time, the progress bar on its own line, the steps. */
  private checklistLines(): string[] {
    const total = this.steps.length;
    const finished = this.steps.filter(
      step => step.state === 'done' || step.state === 'warned',
    ).length;
    const elapsed = colors.muted(duration(this.elapsed()));
    const right =
      finished === total
        ? `${colors.success('✓ ready')} ${colors.muted('in')} ${elapsed}`
        : `${colors.muted(`${finished}/${total} ·`)} ${elapsed}`;
    const title = `  ${colors.accent.bold(this.title)}`;
    const withSubtitle = `${title} ${colors.muted(`· ${this.subtitle}`)}`;
    // On a narrow terminal the subtitle goes first: a wrapped line would break the redraw.
    const left =
      visibleLength(withSubtitle) + visibleLength(right) < this.width ? withSubtitle : title;
    const gap = this.width - visibleLength(left) - visibleLength(right);
    const lines = [
      gap > 0 ? `${left}${' '.repeat(gap)}${right}` : clip(`${left} ${right}`, this.width),
      `  ${progressBar(finished, total, this.barWidth)}`,
      '',
    ];

    this.steps.forEach(step => {
      lines.push(this.stepLine(step));
      if (step.state !== 'active') return;
      if (step.why) {
        wrap(`Why: ${step.why}`, Math.min(this.width - 8, 90)).forEach(line =>
          lines.push(colors.muted(`      ${line}`)),
        );
      }
      if (step.lastLine) lines.push(colors.muted(clip(`      › ${step.lastLine}`, this.width)));
    });

    return lines;
  }

  private menuLines(): string[] {
    if (!this.menu) return [];
    const { message, choices, index } = this.menu;

    return [
      '',
      `  ${colors.accent('?')} ${colors.bold(message)} ${colors.muted('(↑ ↓ then Enter)')}`,
      ...choices.map((choice, position) =>
        clip(
          position === index ? colors.accent(`  ❯ ${choice.name}`) : `    ${choice.name}`,
          this.width,
        ),
      ),
    ];
  }

  /** Terminal rows the lines take, counting the ones a long line wraps onto. */
  private rowsOf(lines: string[]): number {
    const columns = this.stream.columns || 80;

    return lines.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(visibleLength(line) / columns)),
      0,
    );
  }

  /**
   * One frame of the region. The beaver runs on its track above the progress bar while a step
   * loads, and stands there breathing otherwise; a menu drawn without the checklist has it on top.
   */
  private frameLines(withMascot: boolean): string[] {
    const lines = [
      ...(this.checklistLive ? this.checklistLines() : []),
      ...this.after,
      ...this.menuLines(),
    ];
    const shown =
      withMascot &&
      mascotEnabled({
        level: chalk.level,
        env: process.env,
        columns: this.stream.columns,
        rows: this.stream.rows,
        height: this.rowsOf(lines) + (this.checklistLive ? 0 : 1),
      });
    if (!shown) return lines;

    const running = this.steps.some(step => step.state === 'active');
    const beaver = mascotRows(
      running ? 'run' : 'breathe',
      Date.now() - this.bornAt,
      this.barWidth,
      chalk,
      this.checklistLive ? this.barWidth - SPRITE_WIDTH : 0,
    ).map(row => `  ${row}`);
    if (this.checklistLive) lines.splice(1, 0, ...beaver);
    else lines.unshift('', ...beaver);

    return lines;
  }

  /**
   * Redraw the region over its previous frame, in a single write: each line overwrites the old
   * one and clears what is left of it, then whatever the old frame had below is cleared once.
   * Clearing first and drawing after would flash an empty region between frames.
   */
  private render() {
    // A frame as tall as the window cannot be redrawn in place: its top is out of the cursor's
    // reach. Once the steps are over, what sits above the menu is printed for good and only the
    // rest stays live (the beaver then stands over the menu, if it fits there).
    const settled = !this.checklistLive || this.endedAt !== undefined;
    const tall = () => this.rowsOf(this.frameLines(false)) >= (this.stream.rows || 24);
    if (this.live && settled && (this.checklistLive || this.after.length) && tall()) {
      const { menu } = this;
      this.menu = undefined;
      this.draw(this.frameLines(false));
      this.height = 0;
      this.checklistLive = false;
      this.after = [];
      this.menu = menu;
    }

    const lines = this.frameLines(this.live);
    const frame = lines.join('\n');
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    this.draw(lines);
  }

  private draw(lines: string[]) {
    const columns = this.stream.columns || 80;
    // Erasing to the end of a line that exactly fills the window would erase its last character.
    const body = lines.map(line => {
      const length = visibleLength(line);

      return length && length % columns === 0 ? line : `${line}\x1b[K`;
    });
    const up = this.height ? `\x1b[${this.height}A\r` : '';
    this.write(`${up}${body.join('\n')}\n\x1b[0J`);
    this.height = this.rowsOf(lines);
  }

  /** Time since the checklist started, up to its last step. */
  private elapsed(): number {
    return (this.endedAt ?? Date.now()) - this.startedAt;
  }

  /** Start a region redrawn in place, with the cursor hidden until it is released. */
  private goLive(withChecklist: boolean) {
    this.live = true;
    this.checklistLive = withChecklist;
    this.after = [];
    this.height = 0;
    this.lastFrame = '';
    this.write(HIDE_CURSOR);
    process.on('exit', this.restoreOnExit);
    // Ahead of the process runner's hook, which exits before a later listener gets to run.
    process.prependOnceListener('SIGINT', this.restoreOnSigint);
  }

  private restoreTerminal() {
    this.stopListening();
    if (this.live) this.write(SHOW_CURSOR);
  }

  /**
   * Leave the region where it is: what comes next prints below it. Its last frame is drawn
   * without the beaver, which only lives as long as the region does — never under a coding agent
   * or the agent's logs.
   */
  release(): void {
    this.stopTicking();
    this.stopListening();
    if (this.live) {
      this.live = false;
      this.render();
      this.write(SHOW_CURSOR);
      process.removeListener('exit', this.restoreOnExit);
      process.removeListener('SIGINT', this.restoreOnSigint);
    }
    this.checklistLive = false;
    this.after = [];
    this.menu = undefined;
    this.lastFrame = '';
    this.height = 0;
  }

  // ---------- end menu ----------

  /** Whether `choose` can run here: it reads raw keys, so it needs both ends of a terminal. */
  get canChoose(): boolean {
    return this.rich && Boolean(this.stdin.isTTY);
  }

  /**
   * An arrow-key list drawn inside the live region, so the beaver keeps breathing above it while
   * the user picks. Resolves with the chosen value and leaves the answer in the region, which
   * stays live: release it before handing the screen to anything else.
   */
  choose(message: string, choices: MenuChoice[]): Promise<string> {
    if (!this.live) this.goLive(false);
    const menu: Menu = { message, choices, index: 0 };
    this.menu = menu;
    this.render();
    this.startTicking();

    return new Promise(resolve => {
      this.listen(data => {
        menuKeys(data.toString('utf8')).some(key => {
          if (key === 'cancel') {
            this.restoreOnSigint();

            return true;
          }
          if (key === 'enter') {
            const choice = choices[menu.index];
            this.stopTicking();
            this.stopListening();
            this.menu = undefined;
            this.after.push(
              `  ${colors.accent('?')} ${colors.bold(message)} ${colors.info(choice.name)}`,
            );
            this.render();
            resolve(choice.value);

            return true;
          }
          menu.index = menuMove(menu.index, choices.length, key);

          return false;
        });
        if (this.menu) this.render();
      });
    });
  }

  // Raw mode hands over every key as it is typed, Ctrl-C included, instead of whole lines.
  private listen(onKeys: (data: Buffer) => void) {
    this.stopListening();
    this.onKeys = onKeys;
    this.stdin.setRawMode(true);
    this.stdin.on('data', onKeys);
    this.stdin.resume();
  }

  // Paused and cooked again, as inquirer expects to find it for the next question.
  private stopListening() {
    if (!this.onKeys) return;
    this.stdin.removeListener('data', this.onKeys);
    this.onKeys = undefined;
    this.stdin.setRawMode(false);
    this.stdin.pause();
  }

  // ---------- after the checklist ----------

  banner(title: string, lines: string[]): void {
    this.header([colors.accent.bold(title), ...lines]);
  }

  status(items: { label: string; ok: boolean }[], right = ''): void {
    const left = items
      .map(item => `${item.ok ? colors.success('●') : colors.muted('○')} ${item.label}`)
      .join('   ');
    this.print(`\n  ${left}${right ? colors.muted(`   ${right}`) : ''}\n`);
  }

  note(text: string): void {
    this.print(`  ${colors.muted(text)}\n`);
  }
}
