import type { ProjectFacts } from '../services/onboarding/portals';

import { Flags } from '@oclif/core';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import AbstractCommand from '../abstract-command';
import { readProjectEnv } from '../services/onboarding/local-agent';
import { runPortals } from '../services/onboarding/portals';
import OnboardingUI, { colors } from '../services/onboarding/ui';
import { runCapture, runStep } from '../services/process-runner';

export default class PortalsCommand extends AbstractCommand {
  static override description =
    'Open the partner portals of the demo bank: apps outside Forest that call your agent through ' +
    "Forest's Gateway API. Run it in a demo project folder while its agent runs. The first time, " +
    'it sets up what a Gateway key needs (after a yes) and guides you to the key. Ctrl+C stops them.';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Check the project and show what would happen, without installing or starting.',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PortalsCommand);
    const dryRun = flags['dry-run'];
    const projectDir = process.cwd();
    // `code` in backticks stands out, as in the panels.
    const say = (text: string) =>
      this.logger.log(text.replace(/`([^`]+)`/g, (_, code) => colors.accent(code)));

    // `npm` is `npm.cmd` there, as `forest start` says.
    if (process.platform === 'win32') {
      throw new Error('`forest portals` does not run on Windows yet. Use WSL.');
    }

    // The screen of `forest start`, its checks printed for good: no live checklist, no beaver.
    const ui = new OnboardingUI({ rich: true, logName: 'forest-portals' });
    ui.logo("Apps outside Forest, on your agent, through Forest's Gateway.");
    ui.header([
      `${colors.accent.bold('Forest')} ${colors.muted(
        `· partner portals · forest-cli ${this.config.version}`,
      )}`,
      colors.muted('A customer applies with Lagoon; the bank works the case in Forest.'),
      colors.muted(`cwd ${projectDir.replace(process.env.HOME ?? '\0', '~')}`),
    ]);
    this.logger.log('');

    await runPortals({
      projectDir,
      dryRun,
      facts: () => this.projectFacts(projectDir),
      install: version =>
        runStep(
          'npm',
          [
            'install',
            `@forestadmin/agent-bff@${version}`,
            '--save-exact',
            '--no-audit',
            '--no-fund',
          ],
          { cwd: projectDir },
        ),
      // Resolved through this executable, never through the PATH, as `forest start` does. Their
      // output is read, never shown: `environments:get` prints the environment's secret.
      forest: async args =>
        (
          await runCapture(process.execPath, [process.argv[1], ...args], { cwd: projectDir })
        ).stdout,
      runAgent: env => PortalsCommand.runAgent(projectDir, env),
      io: {
        say,
        step: (state, label, detail, why) => ui.line(state, label, detail, why),
        panel: (title, lines) => ui.panel(title, lines),
        confirm: async message =>
          Boolean(process.stdin.isTTY) &&
          (
            await this.context.inquirer.prompt([
              { type: 'confirm', name: 'value', message, default: true },
            ])
          ).value,
        askSecret: async message => {
          if (!process.stdin.isTTY) throw new Error('pasting a key needs a terminal');

          return (
            await this.context.inquirer.prompt([
              { type: 'password', name: 'secret', message, mask: '' },
            ])
          ).secret;
        },
        // Without a terminal (piped, CI), nobody can press Enter: say it and go on.
        pressEnter: async message => {
          if (dryRun || !process.stdin.isTTY) say(`  ${message}`);
          else await this.context.inquirer.prompt([{ type: 'input', name: 'enter', message }]);
        },
        open: async url => {
          await this.context.open(url);
        },
      },
    });
  }

  /**
   * The project's agent, built, started with its .env and these settings over it, in a folder of
   * its own: the demo's data source rebuilds its SQLite file in the working folder, and the agent
   * already running there has that file open. The folder, its copy of the data with it, goes once
   * the agent has stopped.
   */
  private static runAgent(projectDir: string, env: Record<string, string>) {
    const entry = ['dist/index.js', 'index.js']
      .map(file => path.join(projectDir, file))
      .find(file => fs.existsSync(file));
    if (!entry) throw new Error('the agent is not built yet: run npm run build in this folder');

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-portals-agent-'));
    // Kept after the folder goes: a failed activation names it.
    const logFile = path.join(os.tmpdir(), `forest-portals-agent-${Date.now()}.log`);
    const log = fs.openSync(logFile, 'a', 0o600);
    const child = spawn(process.execPath, [entry], {
      cwd,
      env: { ...process.env, ...readProjectEnv(projectDir), ...env },
      stdio: ['ignore', log, log],
      detached: true,
    });
    child.once('exit', () => fs.rmSync(cwd, { recursive: true, force: true }));

    return {
      logFile,
      stop: () => {
        if (child.exitCode !== null || !child.pid) return;
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      },
    };
  }

  /** What the portals' setup depends on, asked to Forest with the user's `forest login`. */
  private async projectFacts(projectDir: string): Promise<ProjectFacts> {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires -- JS services */
    const ProjectManager = require('../services/project-manager');
    const EnvironmentManager = require('../services/environment-manager');
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */

    if (!this.context.authenticator.getAuthToken()) throw new Error('you are not logged in');

    const project = await new ProjectManager({}).getByEnvSecret(
      readProjectEnv(projectDir).FOREST_ENV_SECRET,
    );
    const environments: {
      type: string;
      isActive: boolean;
      areRolesDisabled: boolean;
      currentBranch?: unknown;
      id: string | number;
    }[] = await new EnvironmentManager({ projectId: project.id }).listEnvironments();
    const production = environments.find(env => env.type === 'production');
    const active = Boolean(production?.isActive);
    const development = environments.find(env => env.type === 'development');

    return {
      id: String(project.id),
      name: project.name,
      hasProduction: active && !production?.areRolesDisabled,
      hasBranch: !active || Boolean(development?.currentBranch),
      productionId: production ? String(production.id) : undefined,
    };
  }
}
