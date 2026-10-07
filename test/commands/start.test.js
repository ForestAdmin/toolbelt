const fs = require('fs');

const StartCommand = require('../../src/commands/start').default;
const {
  runCapture,
  runStep,
  startProcess,
  stopProcess,
} = require('../../src/services/process-runner');
const testCli = require('./test-cli-helper/test-cli');

// The process boundary: a test that goes past --dry-run spawns nothing, and says what came back.
jest.mock('../../src/services/process-runner');

// The account's record of a project found on disk: who it is, without calling the API.
const mockGetByEnvSecret = jest.fn();
jest.mock('../../src/services/project-manager', () =>
  jest.fn().mockImplementation(() => ({ getByEnvSecret: mockGetByEnvSecret })),
);

/** Run as if a person sat at a terminal: only then is reopening offered. */
async function asTerminal(run) {
  // The harness swaps process.stdin for a mock, so the TTY is faked on the command itself.
  const interactive = jest
    .spyOn(StartCommand.prototype, 'interactive', 'get')
    .mockReturnValue(true);
  try {
    return await run();
  } finally {
    interactive.mockRestore();
  }
}

function writeSkillsManifest() {
  fs.mkdirSync('x/.forest', { recursive: true });
  fs.writeFileSync('x/.forest/skills-manifest.json', JSON.stringify({ agents: ['claude'] }));
}

/** What `create:sql` scaffolds as ./x, with the manifest `skills:init` writes when asked. */
function scaffoldX({ withSkills }) {
  fs.mkdirSync('x');
  fs.writeFileSync('x/package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
  if (withSkills) writeSkillsManifest();
}

const listPrompt = (message, extra = {}) => ({
  in: [{ type: 'list', name: expect.any(String), message, choices: expect.any(Array), ...extra }],
});

const scaffoldFiles = dir => [
  { name: `${dir}/.env`, content: 'FOREST_ENV_SECRET=secret-of-my-shop\nAPPLICATION_PORT=3310\n' },
  {
    name: `${dir}/package.json`,
    content: JSON.stringify({
      scripts: { build: 'tsc' },
      dependencies: { '@forestadmin/agent': '^1' },
    }),
  },
  { name: `${dir}/index.ts`, content: 'agent.mountOnStandaloneServer(3310);' },
];

// `--dry-run` prints every command instead of running it, so the whole orchestration can be
// asserted with no project created, no package installed and no process spawned. It is also what
// the flow is reviewed with, so testing it keeps the reviewed thing and the tested thing the same.
//
// stdin is not a TTY under the harness, so the interactive tails are skipped — each test asserts
// one flow's command sequence, deterministically.

describe('start', () => {
  describe('reopening a project this machine already has', () => {
    it('boots the project in the current folder instead of creating another', async () => {
      expect.hasAssertions();
      mockGetByEnvSecret.mockReset().mockResolvedValue({ name: 'my-shop' });
      runStep.mockReset().mockResolvedValue(undefined);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: [],
          token: 'valid-token',
          files: scaffoldFiles('.'),
          prompts: [
            {
              ...listPrompt('This folder is the Forest project "my-shop". What do you want to do?'),
              out: { next: 'reopen' },
            },
            { ...listPrompt('Your back-office is live. What next?'), out: { next: 'stay' } },
          ],
          std: [{ out: '(reopening "my-shop"' }, { out: 'Your back-office is live!' }],
        }),
      );

      // Nothing created: no `projects:create:*`, a build (the agent may have changed the code), a boot.
      expect(
        runStep.mock.calls.map(([command, args]) => [command, ...args].join(' ')),
      ).toStrictEqual(['npm install', 'npm run build']);
      expect(startProcess.mock.calls[0].slice(0, 2)).toStrictEqual(['npm', ['start']]);
      expect(startProcess.mock.calls[0][2].cwd).toBe('.');
    });

    it('offers the projects of its subfolders as one more way to start', async () => {
      expect.hasAssertions();
      mockGetByEnvSecret.mockReset().mockResolvedValue({ name: 'my-shop' });
      runStep.mockReset().mockResolvedValue(undefined);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: [],
          token: 'valid-token',
          files: [...scaffoldFiles('my-shop'), ...scaffoldFiles('forest-demo-ab12')],
          prompts: [
            {
              ...listPrompt('How will you run Forest?', {
                choices: expect.arrayContaining([
                  { name: 'Reopen a project in this folder (2 found)', value: 'reopen' },
                ]),
              }),
              out: { flow: 'reopen' },
            },
            {
              ...listPrompt('Which one?'),
              out: {
                project: {
                  dir: 'my-shop',
                  kind: 'scaffold',
                  demo: false,
                  envSecret: 'secret-of-my-shop',
                  name: 'my-shop',
                },
              },
            },
            { ...listPrompt('Your back-office is live. What next?'), out: { next: 'stay' } },
          ],
          std: [{ out: '(reopening "my-shop" — ./my-shop)' }],
        }),
      );

      expect(startProcess.mock.calls[0][2].cwd).toBe('my-shop');
    });

    it('picks up an in-app setup that stopped before the mount, instead of booting an app without Forest', async () => {
      expect.hasAssertions();
      mockGetByEnvSecret.mockReset().mockResolvedValue({ name: 'my-app' });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => () => {} });

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: [],
          token: 'valid-token',
          files: [
            { name: '.env', content: 'FOREST_ENV_SECRET=secret-of-my-app\n' },
            {
              name: 'package.json',
              content: JSON.stringify({
                dependencies: { '@forestadmin/agent': '^1', express: '^4' },
              }),
            },
            { name: 'index.js', content: "require('express')().listen(3000);" },
          ],
          prompts: [
            {
              ...listPrompt('This folder is the Forest project "my-app". What do you want to do?'),
              out: { next: 'reopen' },
            },
            {
              in: [
                {
                  type: 'input',
                  name: 'go',
                  message: 'Once Forest is mounted in your server, press Enter to boot it',
                },
              ],
              out: { go: '' },
            },
            { ...listPrompt('Your back-office is live. What next?'), out: { next: 'stay' } },
          ],
          std: [
            { out: "Forest isn't mounted in this app's code yet" },
            { out: 'Add to your server' },
            { out: 'Forest is live in your app!' },
          ],
        }),
      );

      expect(startProcess.mock.calls[0][2].env).toStrictEqual({ PORT: '3001' });
    });

    it('never offers a project the account does not know: it could only fail on "Not found"', async () => {
      expect.hasAssertions();
      // Deleted since, or another account's.
      mockGetByEnvSecret
        .mockReset()
        .mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: ['--dry-run'],
          token: 'valid-token',
          files: scaffoldFiles('.'),
          prompts: [
            {
              ...listPrompt('How will you run Forest?', {
                choices: [
                  { name: 'Try it with demo data', value: 'demo' },
                  {
                    name: 'Standalone — dedicated server on my database (recommended)',
                    value: 'standalone',
                  },
                  { name: 'In-app — add Forest to my existing app', value: 'inapp' },
                ],
              }),
              out: { flow: 'demo' },
            },
            { ...listPrompt('What next?'), out: { next: 'stop' } },
          ],
          std: [{ not: 'reopening' }, { out: '$ forest projects:create:demo' }],
        }),
      );
    });
  });

  describe('handing over to the coding agent', () => {
    it('says what the entry does, opens the agent on the situation alone, and comes back to the menu', async () => {
      expect.hasAssertions();
      const agentRuns = [];
      const sigintBefore = process.listenerCount('SIGINT');
      runStep.mockReset().mockImplementation(async (command, args, options) => {
        if (args[1] === 'projects:create:sql') scaffoldX({ withSkills: true });
        if (command === 'claude') {
          agentRuns.push({
            seed: args[0],
            cwd: options.cwd,
            // Only the no-op is left: Ctrl-C is the agent's own key, and must not end `start`.
            sigintListeners: process.listenerCount('SIGINT'),
          });
        }
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => () => {} });
      stopProcess.mockReset();

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'x', '--db', 'postgres://u:p@h:5432/db'],
          token: 'valid-token',
          prompts: [
            {
              ...listPrompt('Your back-office is live. What next?', {
                choices: expect.arrayContaining([
                  { name: 'Open Claude Code here, with the Forest skills', value: 'agent' },
                  { name: 'Keep the back-end running here (Ctrl-C to stop)', value: 'stay' },
                ]),
              }),
              out: { next: 'agent' },
            },
            { ...listPrompt('Your back-office is live. What next?'), out: { next: 'stay' } },
          ],
          std: [{ out: 'quitting it brings you back here' }, { out: 'back from Claude Code' }],
        }),
      );

      expect(agentRuns).toHaveLength(1);
      expect(agentRuns[0].cwd).toBe('x');
      expect(agentRuns[0].seed).toContain('then wait for my request');
      expect(agentRuns[0].seed).not.toContain('Help me customise');
      expect(agentRuns[0].sigintListeners).toBe(1);
      // Its handlers are back once the agent is gone…
      expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
      // …and the back-end was never stopped on the way.
      expect(stopProcess).not.toHaveBeenCalled();
    });

    it('sets the skills up first when none are, then asks before opening the agent', async () => {
      expect.hasAssertions();
      const steps = [];
      runStep.mockReset().mockImplementation(async (command, args) => {
        if (args[1] === 'projects:create:sql') scaffoldX({ withSkills: false });
        if (args[1] === 'skills:init') {
          fs.mkdirSync('x/.forest');
          fs.writeFileSync(
            'x/.forest/skills-manifest.json',
            JSON.stringify({ agents: ['claude'] }),
          );
        }
        steps.push(command === process.execPath ? args[1] : command);
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => () => {} });
      // `skills:init` is not among this harness's commands.
      const canInstallSkills = jest
        .spyOn(StartCommand.prototype, 'canInstallSkills', 'get')
        .mockReturnValue(true);

      await asTerminal(() =>
        testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'x', '--db', 'postgres://u:p@h:5432/db'],
          token: 'valid-token',
          prompts: [
            {
              ...listPrompt('Your back-office is live. What next?', {
                choices: expect.arrayContaining([
                  {
                    name: 'Set up your coding agent with the Forest skills, then open it here',
                    value: 'agent',
                  },
                ]),
              }),
              out: { next: 'agent' },
            },
            {
              in: [
                {
                  type: 'confirm',
                  name: 'value',
                  message: 'Open Claude Code here now?',
                  default: true,
                },
              ],
              out: { value: true },
            },
            { ...listPrompt('Your back-office is live. What next?'), out: { next: 'stay' } },
          ],
          std: [{ out: '$ forest skills:init' }],
        }),
      ).finally(() => canInstallSkills.mockRestore());

      expect(steps.slice(-2)).toStrictEqual(['skills:init', 'claude']);
    });
  });

  describe('demo flow', () => {
    it('creates a demo project, builds it and applies the curated layout', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [
          { out: 'Welcome to Forest' },
          { out: '$ forest login' },
          { out: '$ forest projects:create:demo forest-demo-' },
          { out: '-l typescript -H http://localhost -P 3310' },
          { out: '$ npm install' },
          { out: '$ npm run build' },
          { out: '$ forest layout:apply forest-layout.json --with-workflows' },
          { out: 'Demo back-office live →' },
          // Non-interactive: no menu, but never a dead end either.
          { out: 'Connect real data: forest projects:create:sql' },
        ],
      });
    });
  });

  describe('demo flow, past --dry-run', () => {
    it('applies the demo layout without the secret of the .env it was started next to', async () => {
      expect.hasAssertions();
      // Each `forest` step gets this process's environment, and a child's dotenv never overrides
      // it: the secret it sees is the project `layout:apply -f` would land on.
      const seen = [];
      runStep.mockReset().mockImplementation(async (command, args) => {
        const step = command === process.execPath ? args[1] : `${command} ${args.join(' ')}`;
        seen.push([step, process.env.FOREST_ENV_SECRET]);
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'FOREST_ENV_SECRET=secret_of_a_real_project\n' }],
          std: [{ out: 'Demo back-office live →' }],
        });
      } finally {
        delete process.env.FOREST_ENV_SECRET;
      }

      expect(seen).toStrictEqual([
        ['login', undefined],
        ['projects:create:demo', undefined],
        ['npm install', undefined],
        ['layout:apply', undefined],
      ]);
    });

    it("keeps the CLI's own settings from that .env, which a scaffold's .env does not carry", async () => {
      expect.hasAssertions();
      // `layout:apply` runs in the scaffold: a token path set next to `forest start` must reach it.
      const seen = [];
      runStep.mockReset().mockImplementation(async (command, args) => {
        if (command === process.execPath) seen.push([args[1], process.env.TOKEN_PATH]);
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'TOKEN_PATH=/custom/tokens\n' }],
          std: [{ out: 'Demo back-office live →' }],
        });
      } finally {
        delete process.env.TOKEN_PATH;
      }

      expect(seen).toStrictEqual([
        ['login', '/custom/tokens'],
        ['projects:create:demo', '/custom/tokens'],
        ['layout:apply', '/custom/tokens'],
      ]);
    });

    it('draws another demo name when the directory already exists, before creating the project', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });
      const random = jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.123456) // forest-demo-4fzy, taken
        .mockReturnValueOnce(0.654321); // forest-demo-nk00

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: 'forest-demo-4fzy/package.json', content: '{}' }],
          std: [{ out: 'Demo back-office live →' }],
        });
      } finally {
        random.mockRestore();
      }

      expect(runStep.mock.calls[1]).toStrictEqual([
        process.execPath,
        [
          process.argv[1],
          'projects:create:demo',
          'forest-demo-nk00',
          '-l',
          'typescript',
          '-H',
          'http://localhost',
          '-P',
          '3310',
        ],
        { cwd: undefined, env: { FOREST_START_STEP: '1' } },
      ]);
    });
  });

  describe('standalone flow', () => {
    it('passes the connection URL through to create:sql and reports both URLs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'my-back-office',
          '--db',
          'postgres://u:p@h:5432/d',
        ],
        std: [
          // The URL carries credentials: echoed redacted, passed through intact.
          {
            out: '$ forest projects:create:sql my-back-office -l typescript -H http://localhost --databaseConnectionURL <redacted>',
          },
          { out: 'Setup complete — booting your back-end on :3310' },
          { out: 'Your back-office is live!' },
          { out: 'Open it → https://app.forestadmin.com/my-back-office' },
          { out: 'back-end in this terminal (localhost:3310): keep it open.' },
        ],
      });
    });

    it('leaves the database and port prompts to create:sql when no URL is given', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'standalone', '--name', 'x'],
        // No -P: forcing a port would remove the choice of a free one. Credentials never pass
        // through this command either. The trailing newline is the assertion: nothing else follows.
        // Language and hostname have one answer here; the database and port are still asked.
        std: [{ out: '$ forest projects:create:sql x -l typescript -H http://localhost\n' }],
      });
    });

    it('never echoes the database credentials it was given', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'x',
          '--db',
          'postgres://user:hunter2@host:5432/db',
        ],
        // A terminal, a scrollback and a CI log all keep what is printed.
        std: [{ out: '--databaseConnectionURL <redacted>' }, { not: 'hunter2' }],
      });
    });

    it('skips the TypeScript build for a JavaScript scaffold, which has no build script', async () => {
      expect.hasAssertions();
      // What `create:sql` scaffolds when the user picks JavaScript: no build script.
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync(
          'x/package.json',
          JSON.stringify({ scripts: { start: 'node ./index.js' } }),
        );
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        std: [{ out: 'Your back-office is live!' }, { not: '$ npm run build' }],
      });

      expect(runStep.mock.calls).toStrictEqual([
        [
          process.execPath,
          [process.argv[1], 'login'],
          { cwd: undefined, env: { FOREST_START_STEP: '1' } },
        ],
        [
          process.execPath,
          [
            process.argv[1],
            'projects:create:sql',
            'x',
            '-l',
            'typescript',
            '-H',
            'http://localhost',
          ],
          { cwd: undefined, env: { FOREST_START_STEP: '1' } },
        ],
        ['npm', ['install'], { cwd: 'x' }],
      ]);
    });

    it('boots without the .env values this CLI loaded, so the back-end reads its own', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync('x/package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
      });
      // The runner hands a child this process's environment, so that is what the back-end gets.
      let inherited;
      startProcess.mockReset().mockImplementation(() => {
        inherited = process.env.FOREST_START_LEAK;

        return { child: undefined, ready: Promise.resolve(), mute: () => {} };
      });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'x'],
          // Loaded into this process at startup, by a dotenv older than the app's.
          files: [
            { name: '.env', content: 'FOREST_START_LEAK=parent # a comment dotenv 8 keeps\n' },
          ],
          std: [{ out: 'Your back-office is live!' }],
        });
      } finally {
        delete process.env.FOREST_START_LEAK;
      }

      const [[command, args, options]] = startProcess.mock.calls;
      expect([command, args, options.cwd]).toStrictEqual(['npm', ['start'], 'x']);
      expect(inherited).toBeUndefined();
    });

    it("waits for the agent's schema push, not for a server to listen or a mount to start", async () => {
      expect.hasAssertions();
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync('x/package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        std: [{ out: 'Your back-office is live!' }],
      });

      const [[, , { ready }]] = startProcess.mock.calls;
      expect(ready.test('Schema was updated, sending new version')).toBe(true);
      // An app with nothing mounted prints this too: "live" must mean Forest answered.
      expect(ready.test('Listening on http://localhost:3310')).toBe(false);
      // Logged by the framework mounts before `start()` has run, so before it can fail.
      expect(ready.test('Successfully mounted on Express.js')).toBe(false);
    });

    it('refuses a --name whose directory exists, before creating any project', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        files: [{ name: 'x/package.json', content: '{}' }],
        exitMessage: './x already exists — pass another --name.',
      });

      // Only the login ran: `create:sql` would have registered a project for the old app.
      expect(runStep.mock.calls).toStrictEqual([
        [
          process.execPath,
          [process.argv[1], 'login'],
          { cwd: undefined, env: { FOREST_START_STEP: '1' } },
        ],
      ]);
    });

    it('keeps the whole --db URL out of the error when create:sql fails', async () => {
      expect.hasAssertions();
      const db = 'postgres://host:5432/db?password=hunter2';
      // What the runner rejects with: it masks URL userinfo, never a query parameter.
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] === 'projects:create:sql')
          throw new Error(`\`forest ${args.slice(1).join(' ')}\` exited with code 1`);
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x', '--db', db],
        exitMessage:
          '`forest projects:create:sql x -l typescript -H http://localhost --databaseConnectionURL <redacted> -s public -P 3310` exited with code 1',
        std: [{ not: 'hunter2' }],
      });
    });

    it('honours --schema alongside --db', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'x',
          '--db',
          'postgres://u:p@h:5432/d',
          '--schema',
          'analytics',
        ],
        std: [{ out: '-s analytics' }],
      });
    });
  });

  describe('in-app Rails flow', () => {
    it('stops before touching the Gemfile when no secret comes back, so the failure installs nothing', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      runCapture.mockReset().mockResolvedValue({ stdout: '{}', stderr: '' });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        exitMessage:
          'Could not read FOREST_ENV_SECRET from `projects:create:in-app`. Nothing was installed — ' +
          'run it by hand and pass the secret to `bin/rails g forest_admin_rails:install`.',
      });

      expect(runCapture).toHaveBeenCalledWith(
        process.execPath,
        [
          process.argv[1],
          'projects:create:in-app',
          'app',
          '-H',
          'http://localhost',
          '-P',
          '3002',
          '--format',
          'json',
        ],
        { onProgress: expect.any(Function), env: { FOREST_START_STEP: '1' } },
      );
      // Only the login ran: past `bundle add`, five gems and a lockfile change are in the user's
      // repo while the error claims nothing was installed.
      expect(runStep.mock.calls).toStrictEqual([
        [
          process.execPath,
          [process.argv[1], 'login'],
          { cwd: undefined, env: { FOREST_START_STEP: '1' } },
        ],
      ]);
    });

    it('keeps the env secret out of the error when the Rails generator fails', async () => {
      expect.hasAssertions();
      runCapture
        .mockReset()
        .mockResolvedValue({ stdout: JSON.stringify({ envSecret: 'deadbeef' }), stderr: '' });
      // What the runner rejects with: it redacts secret flags, never a bare positional.
      runStep.mockReset().mockImplementation(async (command, args) => {
        if (command === 'bin/rails')
          throw new Error(`\`${command} ${args.join(' ')}\` exited with code 1`);
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        exitMessage: '`bin/rails g forest_admin_rails:install <redacted>` exited with code 1',
        std: [{ not: 'deadbeef' }],
      });
    });

    it('says the schema never arrived, rather than live, when the agent reports the sync failed', async () => {
      expect.hasAssertions();
      runCapture
        .mockReset()
        .mockResolvedValue({ stdout: JSON.stringify({ envSecret: 'deadbeef' }), stderr: '' });
      runStep.mockReset().mockResolvedValue(undefined);
      // Rails boots and serves either way — the only sign is this line, on the same stream.
      startProcess.mockReset().mockImplementation((command, args, options) => {
        options.onOutput('[ForestAdmin] Schema sync failed, continuing without it.');
        options.onOutput('* Listening on http://127.0.0.1:3002');

        return { child: undefined, ready: Promise.resolve(), mute: () => {} };
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        std: [
          { out: 'Forest is mounted, but your schema never reached it.' },
          { out: 'your app exposes at least one model' },
          // The dashboard link still shows: the project exists, it is the schema that is missing.
          { out: 'https://app.forestadmin.com/app' },
          { not: 'Forest is live in your app!' },
        ],
      });
    });

    it('still reports success when the boot says nothing about a failed sync', async () => {
      expect.hasAssertions();
      runCapture
        .mockReset()
        .mockResolvedValue({ stdout: JSON.stringify({ envSecret: 'deadbeef' }), stderr: '' });
      runStep.mockReset().mockResolvedValue(undefined);
      startProcess.mockReset().mockImplementation((command, args, options) => {
        options.onOutput('* Listening on http://127.0.0.1:3002');

        return { child: undefined, ready: Promise.resolve(), mute: () => {} };
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        std: [{ out: 'Forest is live in your app!' }, { not: 'your schema never reached it' }],
      });
    });

    it('registers an in-app project then installs the five gems the boot actually needs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        std: [
          { out: '$ forest projects:create:in-app app -H http://localhost -P 3002 --format json' },
          // Five, not the three the docs list: forest_admin_rails alone installs but fails to boot.
          { out: '$ bundle add forest_admin_agent forest_admin_rails' },
          { out: 'forest_admin_datasource_customizer' },
          { out: '$ bin/rails g forest_admin_rails:install' },
          { out: 'Forest is live in your app!' },
          { out: 'Local /forest → http://localhost:3002/forest' },
        ],
      });
    });
  });

  describe('in-app Node flow', () => {
    it('reads both secrets from the printed output, including an auth secret that is not hex', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      // The human output of `projects:create:in-app`: FOREST_AUTH_SECRET is any string the user owns.
      runCapture.mockReset().mockResolvedValue({
        stdout:
          '  FOREST_ENV_SECRET=abc123\n  FOREST_AUTH_SECRET=myAuthSecret   (you own this one)\n',
        stderr: '',
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'node', '--name', 'app'],
        files: [{ name: 'package.json', content: JSON.stringify({ name: 'app' }) }],
        std: [
          { out: 'FOREST_ENV_SECRET and FOREST_AUTH_SECRET written to .env' },
          { not: 'myAuthSecret' },
        ],
      });
    });

    it('installs the datasource matching the detected ORM and prints the mount snippet', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          { name: 'package.json', content: JSON.stringify({ name: 'app', dependencies: {} }) },
        ],
        std: [
          { out: '$ forest projects:create:in-app app -H http://localhost -P 3001 --format json' },
          // Nothing detected → the defaults, and the snippet matches them.
          { out: '$ npm install @forestadmin/agent @forestadmin/datasource-sql' },
          { out: 'Add to your server' },
          { out: 'createSqlDataSource(process.env.DATABASE_URL)' },
          { out: 'mountOnExpress(app).start();' },
        ],
      });
    });

    it('shows the snippet for --mount ai when this CLI cannot install the skills the agent needs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'ai',
        ],
        std: [
          { out: 'here is the snippet instead' },
          { out: 'Add to your server' },
          { not: 'Your coding agent will wire the mount' },
        ],
      });
    });

    it('names the datasource the snippet uses after the one it installs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          {
            name: 'package.json',
            content: JSON.stringify({ name: 'app', dependencies: { mongoose: '^8.0.0' } }),
          },
        ],
        std: [
          { out: '@forestadmin/datasource-mongoose' },
          // Telling a mongoose app to call createSequelizeDataSource sends it into an import that
          // does not exist…
          { out: 'createMongooseDataSource(connection)' },
          // …and calling a factory that is never loaded does not run either. A CommonJS app gets
          // `require`: `import` there is a SyntaxError.
          {
            out: "const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');",
          },
          { not: 'import {' },
        ],
      });
    });

    it("installs the database driver the SQL datasource needs, read from the app's DATABASE_URL", async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          {
            name: 'package.json',
            content: JSON.stringify({ name: 'app', dependencies: { '@prisma/client': '^5' } }),
          },
          { name: '.env', content: 'DATABASE_URL="postgresql://u:p@localhost:5432/db"\n' },
        ],
        // Without `pg` the agent crashes at boot: "Please install pg package manually".
        std: [{ out: '$ npm install @forestadmin/agent @forestadmin/datasource-sql pg@^8.8.0' }],
      });
    });

    it('says which driver to add when there is no DATABASE_URL to read it from', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          {
            name: 'package.json',
            content: JSON.stringify({ name: 'app', dependencies: { express: '^4' } }),
          },
        ],
        std: [
          { out: '$ npm install @forestadmin/agent @forestadmin/datasource-sql\n' },
          { out: 'No DATABASE_URL found, so no database driver was installed' },
        ],
      });
    });

    it('prints `import` only for an app that can parse it: ES modules or TypeScript', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          {
            name: 'package.json',
            content: JSON.stringify({
              name: 'app',
              type: 'module',
              dependencies: { express: '^4' },
            }),
          },
        ],
        std: [
          { out: "import { createAgent } from '@forestadmin/agent';" },
          { out: "import { createSqlDataSource } from '@forestadmin/datasource-sql';" },
          // A page that exists, not a placeholder path.
          { out: 'Mount options → https://docs.forest.app/reference/agent-api/nodejs' },
        ],
      });
    });

    it('asks how to mount BEFORE creating anything, so declining leaves no stray project', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'standalone',
        ],
        // Adjacent lines prove nothing ran in between. The `not`s prove nothing ran before either:
        // no in-app project created, no package written into the user's own app.
        std: [
          {
            out: 'Forest runs as its own back-end on your DB (no code change).\n\n$ forest projects:create:sql',
          },
          { not: 'projects:create:in-app' },
          { not: '$ npm install @forestadmin/agent' },
        ],
      });
    });

    it('falls back to the standalone flow when the user declines to mount anything', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'standalone',
        ],
        std: [
          { out: 'Forest runs as its own back-end on your DB (no code change).' },
          // The standalone flow takes over — a real project, not a dead end.
          { out: '$ forest projects:create:sql' },
        ],
      });
    });
  });

  describe('on Windows', () => {
    it('refuses before logging in, since every flow creates a project before its first spawn', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32' });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          exitMessage:
            '`forest start` does not run on Windows yet. Use WSL, or follow https://docs.forest.app by hand.',
        });
      } finally {
        Object.defineProperty(process, 'platform', platform);
      }

      expect(runStep).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('skips the browser device flow when a valid session exists', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        token: 'valid-token',
        std: [{ out: 'already logged in' }, { not: '$ forest login' }],
      });
    });

    it('logs in when there is no session', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [{ out: '$ forest login' }, { not: 'already logged in' }],
      });
    });
  });

  describe('--dry-run', () => {
    it('runs nothing at all', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [{ out: '(dry-run — not executed)' }],
      });
    });
  });
});
