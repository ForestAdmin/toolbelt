import type Logger from '../logger';
import type { Chalk } from 'chalk';

import { runCapture, runStep, startProcess } from '../process-runner';
import { masked, redact, scrubbed } from './command-redaction';

const MAX_BACK_END_LINES_HELD_DURING_PROMPT = 20;

/**
 * What `@forestadmin/agent` logs from `start()`, once its schema reached Forest. Neither "Listening
 * on http", which an app with nothing mounted prints too, nor "Successfully mounted on", which the
 * framework mounts log before `start()` has run, and so before it can fail.
 */
const READY = /schema was (updated|not updated)/i;

/** A stream chunk can carry many lines: each gets its own prefix and counts once against the cap. */
const linesOf = (chunk: string): string[] => chunk.replace(/\r?\n$/, '').split(/\r?\n/);

/**
 * How `forest start` runs every step: echoed first, redacted, skipped under --dry-run, and with a
 * booted back-end's log lines held back while a prompt owns the terminal.
 */
export default class StepRunner {
  private backEndLinesHeldDuringPrompt: string[] | undefined;

  private backEndLinesSkippedDuringPrompt = 0;

  private readonly logger: Logger;

  private readonly chalk: Chalk;

  private readonly dryRun: boolean;

  constructor(logger: Logger, chalk: Chalk, dryRun: boolean) {
    this.logger = logger;
    this.chalk = chalk;
    this.dryRun = dryRun;
  }

  echo(command: string, args: string[]): boolean {
    this.logger.log(this.chalk.grey(`\n$ ${redact(command, args)}`));
    if (this.dryRun) this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

    return this.dryRun;
  }

  /** Run a command, echoing it first. The echo is the point: it teaches what the wrapper does. */
  async run(command: string, args: string[], cwd?: string): Promise<void> {
    if (this.echo(command, args)) return undefined;

    return runStep(command, args, { cwd }).catch(error => {
      throw scrubbed(error, command, args);
    });
  }

  /** Invoke one of our own commands. Resolved through this executable, never through the PATH:
   *  under `npx forest-cli@latest start` there may be no `forest` installed anywhere. */
  forest(args: string[], cwd?: string): Promise<void> {
    if (this.echo('forest', args)) return Promise.resolve();

    return runStep(process.execPath, [process.argv[1], ...args], { cwd }).catch(error => {
      throw scrubbed(error, 'forest', args);
    });
  }

  /**
   * Invoke one of our own commands and read its stdout back. `--format json` is only understood by
   * newer CLIs, so a rejection mentioning it is retried without: the flow must not die on a flag.
   * stderr is streamed rather than swallowed — this command prints the secrets and the next steps
   * there, and a silent terminal during project creation reads as a hang.
   *
   * The error message opens with the command, which contains `--format` — testing the whole
   * message would match every failure and re-run a command that creates a project. Only the
   * diagnostic below the first line can say the flag is unknown.
   *
   * NO onProgress on the retry: it captures the human output precisely because that is where the
   * secrets are printed. Echoing it would put a long-lived credential in the terminal, the
   * scrollback and — on the non-interactive path — a retained CI log.
   */
  async forestCapture(args: string[]): Promise<string> {
    if (this.echo('forest', args)) return '';

    const onProgress = (chunk: string) =>
      this.logger.log(this.chalk.grey(masked(chunk, 'forest', args).replace(/\n$/, '')));

    try {
      const { stdout } = await runCapture(process.execPath, [process.argv[1], ...args], {
        onProgress,
      });

      return stdout;
    } catch (error) {
      const [, ...detail] = (error as Error).message.split('\n');
      if (!args.includes('--format') || !/Nonexistent flag/i.test(detail.join('\n'))) {
        throw scrubbed(error, 'forest', args);
      }

      const withoutFormat = args.filter(
        (arg, index) => arg !== '--format' && args[index - 1] !== '--format',
      );
      this.logger.log(
        this.chalk.grey('  (this CLI has no --format json — reading the printed secrets)'),
      );
      const { stdout, stderr } = await runCapture(process.execPath, [
        process.argv[1],
        ...withoutFormat,
      ]).catch(retryError => {
        throw scrubbed(retryError, 'forest', args);
      });

      return `${stdout}\n${stderr}`;
    }
  }

  /**
   * Boot a back-end, streaming its logs, and wait until its schema reached Forest.
   *
   * A boot can succeed and still not deliver what the flow promised. `trouble` is the line that
   * says so, read off the same stream `ready` watches, so the caller can report what happened
   * instead of the tail it would have printed. Non-global on purpose: `test()` on a /g regex
   * carries `lastIndex` between chunks and would start missing matches.
   */
  boot(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; ready?: RegExp; trouble?: RegExp } = {},
  ) {
    let troubled = false;
    const started = startProcess(command, args, {
      ready: options.ready ?? READY,
      cwd: options.cwd,
      env: options.env,
      onOutput: chunk => {
        if (options.trouble?.test(chunk)) troubled = true;
        linesOf(chunk).forEach(line => this.printBackEndLine(this.chalk.grey(`  | ${line}`)));
      },
    });

    return Object.assign(started, { troubled: () => troubled });
  }

  /** Hold the back-end lines while `work` owns the terminal with a prompt, then print them. */
  async holdBackEndLines<T>(work: () => Promise<T>): Promise<T> {
    if (this.backEndLinesHeldDuringPrompt) return work();

    this.backEndLinesHeldDuringPrompt = [];
    try {
      return await work();
    } finally {
      this.releaseBackEndLines();
    }
  }

  private printBackEndLine(line: string): void {
    const held = this.backEndLinesHeldDuringPrompt;
    if (!held) {
      this.logger.log(line);

      return;
    }

    held.push(line);
    if (held.length > MAX_BACK_END_LINES_HELD_DURING_PROMPT) {
      held.shift();
      this.backEndLinesSkippedDuringPrompt += 1;
    }
  }

  private releaseBackEndLines(): void {
    const held = this.backEndLinesHeldDuringPrompt ?? [];
    const skipped = this.backEndLinesSkippedDuringPrompt;
    this.backEndLinesHeldDuringPrompt = undefined;
    this.backEndLinesSkippedDuringPrompt = 0;

    if (skipped) {
      this.logger.log(this.chalk.grey(`  | … ${skipped} earlier back-end lines not shown`));
    }
    held.forEach(line => this.logger.log(line));
  }
}
