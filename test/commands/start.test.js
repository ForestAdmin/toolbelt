const dotenv = require('dotenv');
const fs = require('fs');
const nock = require('nock');
const { stdout } = require('stdout-stderr');

const StartCommand = require('../../src/commands/start').default;
const ExitCodeError = require('../../src/services/exit-code-error').default;
const {
  runCapture,
  runStep,
  startProcess,
  stopAllProcesses,
  stopProcess,
} = require('../../src/services/process-runner');
const testCli = require('./test-cli-helper/test-cli');

const rawFromCliDotenv = (name, content) => {
  const loaded = name === '.env' ? dotenv.parse(content).FOREST_SERVER_URL : undefined;
  return loaded === undefined ? {} : { RAW_FOREST_SERVER_URL: loaded };
};

// The process boundary: a test that goes past --dry-run spawns nothing, and says what came back.
jest.mock('../../src/services/process-runner');

// `--dry-run` prints every command instead of running it, so the whole orchestration can be
// asserted with no project created, no package installed and no process spawned. It is also what
// the flow is reviewed with, so testing it keeps the reviewed thing and the tested thing the same.
//
// stdin is not a TTY under the harness, so the interactive tails are skipped — each test asserts
// one flow's command sequence, deterministically.

const CLAIM = 'SENTINELclaimAAAAAAAAAAAAAAAAAAAA';
const INSPECT = '/api/developer-invitations/claim/inspect';
const SERVER = 'http://localhost:3001';
const env = { FOREST_SERVER_URL: SERVER, FOREST_URL_IS_DEFAULT: true };
const ADA = { name: 'Ada Lovelace', email: 'ada@example.com' };
const LABEL = 'ada@example.com (Ada Lovelace)';
const PACKAGE_JSON = {
  name: 'package.json',
  content: JSON.stringify({ name: 'app', dependencies: { sequelize: '^6.0.0' } }),
};

const inspect = (status, body, headers) => () =>
  nock(SERVER).post(INSPECT, { claim: CLAIM }).reply(status, body, headers);
const inspectOk = (body = { inviter: ADA, project: null }) => inspect(200, body);
const refusal = (status, code, detail) =>
  inspect(status, { errors: [{ status, detail, meta: { code } }] });

const createSteps = () =>
  [...runStep.mock.calls, ...runCapture.mock.calls]
    .map(([, args]) => args)
    .filter(args => String(args?.[1]).startsWith('projects:create'));

const forceTty = () =>
  jest.spyOn(StartCommand.prototype, 'interactive', 'get').mockReturnValue(true);

const resetProcessMocks = () => {
  runStep.mockReset().mockResolvedValue(undefined);
  runCapture.mockReset().mockResolvedValue({ stdout: '', stderr: '' });
  startProcess
    .mockReset()
    .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });
};

describe('start', () => {
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
          { out: 'Demo back-office live.' },
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
      const record = async (command, args) => {
        const step = command === process.execPath ? args[1] : `${command} ${args.join(' ')}`;
        seen.push([step, process.env.FOREST_ENV_SECRET]);
      };
      runStep.mockReset().mockImplementation(record);
      runCapture.mockReset().mockImplementation(record);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'FOREST_ENV_SECRET=secret_of_a_real_project\n' }],
          std: [{ out: 'Demo back-office live.' }],
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
      const record = async (command, args) => {
        if (command === process.execPath) seen.push([args[1], process.env.TOKEN_PATH]);
      };
      runStep.mockReset().mockImplementation(record);
      runCapture.mockReset().mockImplementation(record);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'TOKEN_PATH=/custom/tokens\n' }],
          std: [{ out: 'Demo back-office live.' }],
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

    it('applies the layout from the demo directory, with its stderr piped for the warning', async () => {
      expect.hasAssertions();
      resetProcessMocks();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'demo'],
        std: [{ out: 'Demo back-office live.' }],
      });

      const layoutCalls = runStep.mock.calls.filter(([, args]) => args[1] === 'layout:apply');
      expect(layoutCalls).toStrictEqual([
        [
          process.execPath,
          [
            process.argv[1],
            'layout:apply',
            'forest-layout.json',
            '--with-workflows',
            '-e',
            'Development',
            '-t',
            'Operations',
            '-f',
          ],
          { cwd: expect.stringMatching(/^forest-demo-/), onStderr: expect.any(Function) },
        ],
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
          std: [{ out: 'Demo back-office live.' }],
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
        { cwd: undefined },
      ]);
    });
  });

  describe('demo flow, when layout:apply fails', () => {
    const DEMO_MENU = {
      type: 'list',
      name: 'next',
      message: 'Your demo back-end is live on :3310. What next?',
      choices: [
        { name: 'Connect my real database (create a real project)', value: 'db' },
        { name: 'Keep exploring — leave the back-end running', value: 'stay' },
        { name: 'Stop', value: 'stop' },
      ],
    };
    const child = { pid: 4242 };
    const layoutFails = error =>
      runStep.mockImplementation(async (_, args) => {
        if (args[1] === 'layout:apply') throw error;
      });

    const resetDemoMocks = () => {
      resetProcessMocks();
      stopProcess.mockReset();
      stopAllProcesses.mockReset();
      startProcess.mockReturnValue({
        child,
        ready: Promise.resolve(),
        exited: Promise.resolve(),
        mute: () => {},
      });
    };

    it('warns with the failed part and reaches the menu with the back-end still running', async () => {
      expect.hasAssertions();
      resetDemoMocks();
      layoutFails(
        new ExitCodeError(
          '`forest layout:apply` exited with code 2:\n× Failed part: workflows — Server error (402): Feature is not active on project',
          2,
        ),
      );

      const tty = forceTty();
      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          prompts: [{ in: [DEMO_MENU], out: { next: 'stop' } }],
          std: [
            {
              out: 'The curated layout did not finish applying: it stopped at its workflows part.',
            },
            { out: 'Your demo project works without it.' },
            { out: 'Retry anytime: cd forest-demo-' },
            { out: 'Demo back-office live.' },
            { out: 'Stopped. Relaunch the demo anytime' },
          ],
        });
      } finally {
        tty.mockRestore();
      }

      expect(stopAllProcesses).not.toHaveBeenCalled();
      expect(stopProcess.mock.calls).toStrictEqual([[child]]);
    });

    it('holds the back-end lines while the menu is open and prints them once it is answered', async () => {
      expect.hasAssertions();
      resetDemoMocks();
      let emitBackEndLine;
      startProcess.mockImplementation((command, args, options) => {
        emitBackEndLine = options.onOutput;

        return { child, ready: Promise.resolve(), exited: Promise.resolve(), mute: () => {} };
      });
      let printedWhileMenuOpen;
      const answeredMenu = {
        in: [DEMO_MENU],
        get out() {
          emitBackEndLine('info: [200] GET /authentication/callback');
          printedWhileMenuOpen = stdout.output.includes('GET /authentication/callback');

          return { next: 'stop' };
        },
      };

      const tty = forceTty();
      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          prompts: [answeredMenu],
          std: [{ out: '  | info: [200] GET /authentication/callback' }],
        });
      } finally {
        tty.mockRestore();
      }

      expect(printedWhileMenuOpen).toBe(false);
    });

    it('warns that the curated layout did not finish when no part is named', async () => {
      expect.hasAssertions();
      resetDemoMocks();
      layoutFails(
        new ExitCodeError('`forest layout:apply` exited with code 1:\nSession expired', 1),
      );

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'demo'],
        std: [
          {
            out: 'The curated layout did not finish applying. Your demo project works without it.',
          },
          { out: 'Demo back-office live.' },
          { out: 'Launch it anytime: cd forest-demo-' },
        ],
      });

      expect(stopAllProcesses).not.toHaveBeenCalled();
    });

    it('still stops everything when the demo project cannot be created', async () => {
      expect.hasAssertions();
      resetDemoMocks();
      runStep.mockImplementation(async (_, args) => {
        if (args[1] === 'projects:create:demo') throw new Error('creation refused');
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'demo'],
        exitMessage: 'creation refused',
      });

      expect(stopAllProcesses.mock.calls).toStrictEqual([[]]);
      expect(runStep.mock.calls.map(([, args]) => args[1])).not.toContain('layout:apply');
    });

    it.each([
      ['layout:apply cannot be spawned', new Error('spawn node ENOENT')],
      [
        'layout:apply is killed by a signal',
        new ExitCodeError('`forest layout:apply` exited with code null', null),
      ],
    ])('stops everything when %s', async (_, error) => {
      expect.hasAssertions();
      resetDemoMocks();
      layoutFails(error);

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'demo'],
        exitMessage: error.message,
      });

      expect(stopAllProcesses.mock.calls).toStrictEqual([[]]);
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
            out: '$ forest projects:create:sql my-back-office --databaseConnectionURL <redacted>',
          },
          { out: 'Setup complete — booting your back-end on :3310' },
          { out: 'Your back-office is live!' },
          { out: 'Open it → https://app.forestadmin.com/my-back-office' },
          { out: 'Served by → http://localhost:3310' },
        ],
      });
    });

    it('leaves every prompt to create:sql when no URL is given', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'standalone', '--name', 'x'],
        // Bare on purpose: forcing -l/-H/-P here would silently remove the choice of JavaScript,
        // of a hostname, or of a free port. Credentials never pass through this command either.
        // The trailing newline is the assertion: nothing follows the project name on that line.
        std: [{ out: '$ forest projects:create:sql x\n' }],
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
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
        [process.execPath, [process.argv[1], 'projects:create:sql', 'x'], { cwd: undefined }],
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
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
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
          '`forest projects:create:sql x --databaseConnectionURL <redacted> -s public -l typescript -H http://localhost -P 3310` exited with code 1',
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
        { onProgress: expect.any(Function) },
      );
      // Only the login ran: past `bundle add`, five gems and a lockfile change are in the user's
      // repo while the error claims nothing was installed.
      expect(runStep.mock.calls).toStrictEqual([
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
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

    describe('on a non-default Forest server', () => {
      const INITIALIZER = 'config/initializers/forest_admin_rails.rb';
      const GENERATED =
        'ForestAdminRails.configure do |config|\n' +
        "  config.auth_secret = 'a1'\n" +
        "  config.env_secret = 'deadbeef'\n" +
        'end\n';
      const DEV = { FOREST_SERVER_URL: 'https://api.development.forestadmin.com' };
      const PINNED =
        "  config.forest_server_url = ENV.fetch('FOREST_SERVER_URL', 'https://api.development.forestadmin.com') unless Rails.env.production?\n";

      const RAILS_SERVER = { command: 'bin/rails', args: ['server', '-p', '3002'] };

      let atBoot;

      const generatorWrites = content => {
        runStep.mockReset().mockImplementation(async command => {
          if (command !== 'bin/rails') return;
          fs.mkdirSync('config/initializers', { recursive: true });
          if (content !== null) fs.writeFileSync(INITIALIZER, content);
        });
      };

      const setup = (generated = GENERATED) => {
        atBoot = undefined;
        runCapture
          .mockReset()
          .mockResolvedValue({ stdout: JSON.stringify({ envSecret: 'deadbeef' }), stderr: '' });
        generatorWrites(generated);
        startProcess.mockReset().mockImplementation((command, args, options) => {
          atBoot = { command, args, file: fs.readFileSync(INITIALIZER, 'utf8'), env: options.env };

          return { child: undefined, ready: Promise.resolve(), mute: () => {} };
        });
      };

      const run = runEnv =>
        testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          env: runEnv,
          std: [{ out: 'Forest is live in your app!' }],
        });

      it('points the initializer and the boot at that server, the deploy env first', async () => {
        expect.hasAssertions();
        setup();

        await run({ ...DEV, FOREST_URL_IS_DEFAULT: false });

        expect(atBoot).toStrictEqual({
          ...RAILS_SERVER,
          file:
            'ForestAdminRails.configure do |config|\n' +
            `${PINNED}` +
            "  config.auth_secret = 'a1'\n" +
            "  config.env_secret = 'deadbeef'\n" +
            'end\n',
          env: { FOREST_SERVER_URL: DEV.FOREST_SERVER_URL },
        });
      });

      it('leaves the initializer as generated on the default server', async () => {
        expect.hasAssertions();
        setup();

        await run({
          FOREST_SERVER_URL: 'https://api.forestadmin.com',
          FOREST_URL_IS_DEFAULT: true,
        });

        expect(atBoot).toStrictEqual({
          ...RAILS_SERVER,
          file: GENERATED,
          env: { FOREST_SERVER_URL: 'https://api.forestadmin.com' },
        });
      });

      it.each([
        ["https://x.test/'+`id`+'"],
        ['https://x.test/\nputs 1\n#'],
        ['https://x.test/\\'],
        ['ftp://x.test'],
      ])('refuses %j before creating anything, as it would land in Ruby source', async url => {
        expect.hasAssertions();
        setup();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          env: {
            FOREST_SERVER_URL: url,
            FOREST_SERVER_URL_SOURCE: 'FOREST_URL',
            FOREST_URL_IS_DEFAULT: false,
          },
          exitMessage: `FOREST_URL must be an http(s) URL with no quote, backslash or whitespace: ${JSON.stringify(
            url,
          )}`,
        });

        expect(runCapture).not.toHaveBeenCalled();
      });

      it('leaves an initializer an earlier run already pointed there as it is', async () => {
        expect.hasAssertions();
        const kept = `ForestAdminRails.configure do |config|\n${PINNED}  config.env_secret = 'old'\nend\n`;
        setup(kept);

        await run({ ...DEV, FOREST_URL_IS_DEFAULT: false });

        expect(atBoot).toStrictEqual({ ...RAILS_SERVER, file: kept, env: DEV });
      });

      it('keeps the CRLF line endings of an initializer, pinned before or not', async () => {
        expect.hasAssertions();
        const crlf = text => text.replace(/\n/g, '\r\n');
        const kept = crlf(`ForestAdminRails.configure do |config|\n${PINNED}end\n`);
        setup(kept);
        await run({ ...DEV, FOREST_URL_IS_DEFAULT: false });
        expect(atBoot).toStrictEqual({ ...RAILS_SERVER, file: kept, env: DEV });

        setup(crlf(GENERATED));
        await run({ ...DEV, FOREST_URL_IS_DEFAULT: false });
        expect(atBoot.file).toBe(crlf(GENERATED.replace('|config|\n', `|config|\n${PINNED}`)));
      });

      it.each([['https://api.forestadmin.com'], ['']])(
        'refuses a FOREST_SERVER_URL of %j that a later restart would pick over FOREST_URL',
        async rawUrl => {
          expect.hasAssertions();
          setup();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
            env: {
              ...DEV,
              FOREST_URL_IS_DEFAULT: false,
              RAW_FOREST_SERVER_URL: rawUrl,
            },
            exitMessage:
              `FOREST_SERVER_URL=${rawUrl} would send a later \`bin/rails server\` ` +
              `to another server than FOREST_URL=${DEV.FOREST_SERVER_URL}. Unset it, or set it to the same URL.`,
          });

          expect(runCapture).not.toHaveBeenCalled();
        },
      );

      it.each([
        ['.env.development', 'FOREST_SERVER_URL=https://api.forestadmin.com\n'],
        ['.env', 'export FOREST_SERVER_URL=https://api.forestadmin.com\n'],
        ['.env', 'FOREST_SERVER_URL=https://api.forestadmin.com\n'],
        ['.env.local', "export FOREST_SERVER_URL = 'https://api.forestadmin.com' # prod\n"],
        ['.env', 'FOREST_SERVER_URL: https://api.forestadmin.com\n'],
        [
          '.env.development.local',
          `FOREST_SERVER_URL=${DEV.FOREST_SERVER_URL}\nFOREST_SERVER_URL=https://api.forestadmin.com\n`,
        ],
      ])(
        'refuses a %s that dotenv-rails would load over FOREST_URL on a restart',
        async (name, content) => {
          expect.hasAssertions();
          setup();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
            files: [{ name, content }],
            env: { ...DEV, FOREST_URL_IS_DEFAULT: false, ...rawFromCliDotenv(name, content) },
            exitMessage:
              `${name} sets FOREST_SERVER_URL=https://api.forestadmin.com, which would send a later ` +
              `\`bin/rails server\` to another server than ${DEV.FOREST_SERVER_URL}. ` +
              'Remove that line, or set it to the same URL.',
          });

          expect(runCapture).not.toHaveBeenCalled();
        },
      );

      it.each([
        ['.env.staging', { RAILS_ENV: 'staging' }, []],
        [
          '.env.development',
          {},
          [{ name: '.env', content: `FOREST_SERVER_URL=${DEV.FOREST_SERVER_URL}\n` }],
        ],
      ])(
        'refuses a %s that dotenv-rails loads first for that rails env',
        async (name, railsEnv, others) => {
          expect.hasAssertions();
          setup();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
            files: [
              { name, content: 'FOREST_SERVER_URL=https://api.forestadmin.com\n' },
              ...others,
            ],
            env: { ...DEV, ...railsEnv, FOREST_URL_IS_DEFAULT: false },
            exitMessage:
              `${name} sets FOREST_SERVER_URL=https://api.forestadmin.com, which would send a later ` +
              `\`bin/rails server\` to another server than ${DEV.FOREST_SERVER_URL}. ` +
              'Remove that line, or set it to the same URL.',
          });

          expect(runCapture).not.toHaveBeenCalled();
        },
      );

      it.each([
        ['a .env without FOREST_SERVER_URL', [{ name: '.env', content: 'SECRET_KEY_BASE=x\n' }]],
        [
          'a .env.development without it over a .env that names the same server',
          [
            { name: '.env.development', content: 'SECRET_KEY_BASE=x\n' },
            { name: '.env', content: `FOREST_SERVER_URL=${DEV.FOREST_SERVER_URL}\n` },
          ],
        ],
        [
          'a .env.local that dotenv-rails skips in the test env',
          [{ name: '.env.local', content: 'FOREST_SERVER_URL=https://api.forestadmin.com\n' }],
          { RAILS_ENV: 'test' },
        ],
      ])('boots with %s', async (_, files, railsEnv = {}) => {
        expect.hasAssertions();
        setup();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          files,
          env: { ...DEV, ...railsEnv, FOREST_URL_IS_DEFAULT: false },
          std: [{ out: 'Forest is live in your app!' }],
        });

        expect(atBoot).toStrictEqual({
          ...RAILS_SERVER,
          file:
            'ForestAdminRails.configure do |config|\n' +
            `${PINNED}` +
            "  config.auth_secret = 'a1'\n" +
            "  config.env_secret = 'deadbeef'\n" +
            'end\n',
          env: DEV,
        });
      });

      it('accepts a .env.development that names the same server', async () => {
        expect.hasAssertions();
        setup();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          files: [
            { name: '.env.development', content: `FOREST_SERVER_URL="${DEV.FOREST_SERVER_URL}"\n` },
          ],
          env: { ...DEV, FOREST_URL_IS_DEFAULT: false },
          std: [{ out: 'Forest is live in your app!' }],
        });

        expect(atBoot).toStrictEqual({
          ...RAILS_SERVER,
          file:
            'ForestAdminRails.configure do |config|\n' +
            `${PINNED}` +
            "  config.auth_secret = 'a1'\n" +
            "  config.env_secret = 'deadbeef'\n" +
            'end\n',
          env: DEV,
        });
      });

      it('names FOREST_SERVER_URL when the unsafe URL comes from it', async () => {
        expect.hasAssertions();
        setup();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          env: {
            FOREST_SERVER_URL: 'ftp://x.test',
            FOREST_SERVER_URL_SOURCE: 'FOREST_SERVER_URL',
            RAW_FOREST_SERVER_URL: 'ftp://x.test',
            FOREST_URL_IS_DEFAULT: false,
          },
          exitMessage:
            'FOREST_SERVER_URL must be an http(s) URL with no quote, backslash or whitespace: "ftp://x.test"',
        });

        expect(runCapture).not.toHaveBeenCalled();
      });

      it.each([
        ['is missing', null],
        ['has no configure block', "ForestAdminRails.config.env_secret = 'deadbeef'\n"],
        [
          'opens and closes its block on one line',
          "ForestAdminRails.configure do |config|; config.env_secret = 'deadbeef'; end\n",
        ],
        [
          'spreads the server over two lines',
          'ForestAdminRails.configure do |config|\n' +
            '  config.forest_server_url = ENV.fetch(\n' +
            "    'FOREST_SERVER_URL', 'https://api.staging.forestadmin.com')\n" +
            'end\n',
        ],
        [
          'already sets another server',
          'ForestAdminRails.configure do |config|\n' +
            "  config.forest_server_url = 'https://api.staging.forestadmin.com'\n" +
            'end\n',
        ],
        [
          'sets the server only outside production',
          'ForestAdminRails.configure do |config|\n' +
            "  config.forest_server_url = 'https://a.test' if Rails.env.production?\n" +
            'end\n',
        ],
        [
          'overrides an earlier pin further down',
          `ForestAdminRails.configure do |config|\n${PINNED}` +
            "  config.forest_server_url = 'https://api.staging.forestadmin.com'\n" +
            'end\n',
        ],
        ['holds the pin commented out', `ForestAdminRails.configure do |config|\n#${PINNED}end\n`],
        [
          'sets the server twice',
          'ForestAdminRails.configure do |config|\n' +
            "  config.forest_server_url = 'https://a.test'\n" +
            "  config.forest_server_url = 'https://b.test'\n" +
            'end\n',
        ],
        [
          'sets the server beside another statement',
          'ForestAdminRails.configure do |config|\n' +
            "  config.forest_server_url = 'https://a.test'; config.env_secret = 'deadbeef'\n" +
            'end\n',
        ],
      ])('stops before the boot when the initializer %s', async (_, content) => {
        expect.hasAssertions();
        setup(content);

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          env: { ...DEV, FOREST_URL_IS_DEFAULT: false },
          exitMessage:
            `Could not point ${INITIALIZER} at ${DEV.FOREST_SERVER_URL}. In its ` +
            '`ForestAdminRails.configure` block, replace any `config.forest_server_url` line ' +
            'with this one, then run `bin/rails server -p 3002`:\n' +
            `${PINNED.trimEnd()}`,
        });

        expect(startProcess).not.toHaveBeenCalled();
      });

      it('shows the step in a dry run, and writes nothing', async () => {
        expect.hasAssertions();
        setup();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--dry-run', '--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          env: { ...DEV, FOREST_URL_IS_DEFAULT: false },
          std: [
            { out: `→ ${INITIALIZER}:${PINNED.trimEnd().replace(/^ +/, ' ')}` },
            { out: 'Forest is live in your app!' },
          ],
        });

        expect(fs.existsSync(INITIALIZER)).toBe(false);
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

    it.each([
      [
        {
          FOREST_SERVER_URL: 'https://api.development.forestadmin.com',
          FOREST_URL_IS_DEFAULT: false,
        },
        'out',
      ],
      [{ FOREST_SERVER_URL: 'https://api.forestadmin.com', FOREST_URL_IS_DEFAULT: true }, 'not'],
    ])(
      'points the snippet at the Forest server only when it is not the default (%j)',
      async (serverEnv, expectation) => {
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
          env: serverEnv,
          std: [
            { out: 'Add to your server' },
            {
              [expectation]: 'forestServerUrl: process.env.FOREST_SERVER_URL, isProduction: false',
            },
            { [expectation]: 'FOREST_AUTH_SECRET / FOREST_SERVER_URL)' },
          ],
        });
      },
    );

    it('writes the non-default Forest server to .env with the secrets', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      runCapture.mockReset().mockResolvedValue({
        stdout: JSON.stringify({ envSecret: 'deadbeef', authSecret: 'a1' }),
        stderr: '',
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'node', '--name', 'app', '--mount', 'manual'],
        env: {
          FOREST_SERVER_URL: 'https://api.development.forestadmin.com',
          FOREST_URL_IS_DEFAULT: false,
        },
        files: [{ name: 'package.json', content: JSON.stringify({ name: 'app' }) }],
        std: [
          { out: 'FOREST_ENV_SECRET and FOREST_AUTH_SECRET and FOREST_SERVER_URL written to .env' },
          { out: 'forestServerUrl: process.env.FOREST_SERVER_URL' },
        ],
      });
    });

    it('refuses a .env sending the app to another server before creating the project', async () => {
      expect.hasAssertions();
      resetProcessMocks();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'node', '--name', 'app', '--mount', 'manual'],
        env: {
          FOREST_SERVER_URL: 'https://api.development.forestadmin.com',
          FOREST_URL_IS_DEFAULT: false,
          RAW_FOREST_SERVER_URL: 'https://api.forestadmin.com',
        },
        files: [{ name: '.env', content: 'FOREST_SERVER_URL=https://api.forestadmin.com\n' }],
        exitMessage:
          '.env sets FOREST_SERVER_URL=https://api.forestadmin.com, which would send your app to ' +
          'another server than https://api.development.forestadmin.com. Remove that line, or set ' +
          'it to the same URL.',
      });

      expect(createSteps()).toStrictEqual([]);
    });

    it.each([
      [
        {
          FOREST_SERVER_URL: 'https://api.development.forestadmin.com',
          FOREST_URL_IS_DEFAULT: false,
        },
        true,
      ],
      [{ FOREST_SERVER_URL: 'https://api.forestadmin.com', FOREST_URL_IS_DEFAULT: true }, false],
    ])(
      'tells the coding agent to pass forestServerUrl only off the default server (%j)',
      async (serverEnv, named) => {
        expect.hasAssertions();
        resetProcessMocks();
        runCapture.mockResolvedValue({
          stdout: JSON.stringify({ envSecret: 'deadbeef', authSecret: 'a1' }),
          stderr: '',
        });
        startProcess.mockImplementation(() => {
          throw new Error('stop at the boot');
        });

        const tty = forceTty();
        const skills = jest
          .spyOn(StartCommand.prototype, 'canInstallSkills', 'get')
          .mockReturnValue(true);
        try {
          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'inapp', '--stack', 'node', '--name', 'app', '--mount', 'ai'],
            env: serverEnv,
            files: [
              PACKAGE_JSON,
              {
                name: '.forest/skills-manifest.json',
                content: JSON.stringify({ agents: ['claude'] }),
              },
            ],
            prompts: [
              {
                in: [
                  {
                    type: 'confirm',
                    name: 'value',
                    message: 'Launch Claude Code now to wire the mount?',
                    default: true,
                  },
                ],
                out: { value: true },
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
            ],
            exitMessage: 'stop at the boot',
          });
        } finally {
          skills.mockRestore();
          tty.mockRestore();
        }

        const [[, [seed]]] = runStep.mock.calls.filter(([command]) => command === 'claude');
        expect(seed.includes('Pass `forestServerUrl: process.env.FOREST_SERVER_URL`')).toBe(named);
      },
    );

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
          // …and calling a factory that is never imported does not compile either.
          { out: "import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';" },
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

  describe('--organization', () => {
    it.each([
      [['--flow', 'demo'], '$ forest projects:create:demo forest-demo-'],
      [['--flow', 'standalone', '--name', 'x'], '$ forest projects:create:sql x --organization 42'],
      [
        ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        '$ forest projects:create:in-app app -H http://localhost -P 3002 --format json --organization 42',
      ],
      [
        ['--flow', 'inapp', '--stack', 'node', '--mount', 'manual', '--name', 'app'],
        '$ forest projects:create:in-app app -H http://localhost -P 3001 --format json --organization 42',
      ],
      [
        ['--flow', 'inapp', '--stack', 'node', '--mount', 'standalone', '--name', 'x'],
        '$ forest projects:create:sql x --organization 42',
      ],
    ])('passes it to the project creation of %j', async (flowArgs, creation) => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', ...flowArgs, '--organization', '42'],
        std: [{ out: creation }, { out: '--organization 42' }],
      });
    });

    it('points the real-data hint after a demo at the same organization', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo', '--organization', '42'],
        std: [{ out: 'Connect real data: forest projects:create:sql --organization 42' }],
      });
    });

    it('keeps the project creation without it in the Personal space', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [{ out: '$ forest projects:create:demo' }, { not: '--organization' }],
      });
    });

    it('refuses an id that is not a positive integer before logging in', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'demo', '--organization', 'acme'],
        exitMessage:
          'Invalid value for --organization: The organization must be a positive integer id, like 42.',
      });

      expect(runStep).not.toHaveBeenCalled();
    });

    it('refuses it with --invitation before logging in', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--flow',
          'standalone',
          '--organization',
          '42',
          '--invitation',
          'SENTINELclaimAAAAAAAAAAAAAAAAAAAA',
          '--yes',
        ],
        exitMessage:
          '--organization cannot be used with --invitation: the invitation creates the project for the inviter.',
      });

      expect(runStep).not.toHaveBeenCalled();
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

  describe('--invitation', () => {
    describe('with --dry-run', () => {
      it.each([
        ['demo', ['--flow', 'demo'], '$ forest projects:create:demo forest-demo-'],
        [
          'standalone',
          ['--flow', 'standalone', '--name', 'app'],
          '$ forest projects:create:sql app --invitation <redacted>\n',
        ],
        [
          'in-app Node',
          ['--flow', 'inapp', '--stack', 'node', '--name', 'app', '--mount', 'manual'],
          '--format json --invitation <redacted>\n',
        ],
        [
          'in-app Rails',
          ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
          '--format json --invitation <redacted>\n',
        ],
        [
          'in-app Node mounted on standalone',
          ['--flow', 'inapp', '--stack', 'node', '--name', 'app', '--mount', 'standalone'],
          '$ forest projects:create:sql app --invitation <redacted>\n',
        ],
      ])('forwards the claim to the %s creation, redacted in the echo', async (_, args, echo) => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--dry-run', ...args, '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          files: [PACKAGE_JSON],
          std: [
            { out: '(dry-run — invitation not checked)' },
            { out: echo },
            { out: '--invitation <redacted>' },
            { not: CLAIM },
          ],
        });
      });

      it('forwards the claim to the demo creation only, never to the real project after it', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--dry-run', '--flow', 'demo', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          std: [
            { out: 'P 3310 --invitation <redacted>\n' },
            { out: 'Connect real data: forest projects:create:sql' },
            { not: CLAIM },
          ],
        });
      });
    });

    describe('without a terminal', () => {
      it('still names the inviter when SILENT drops every logger line', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo', '--invitation', CLAIM, '--yes'],
          env: { ...env, SILENT: '1' },
          token: 'valid-token',
          api: [inspectOk()],
          std: [
            { out: `Creating this project for ${LABEL} (confirmed with --yes).` },
            { not: CLAIM },
          ],
        });
      });

      it('checks the claim, names the inviter, then creates with the claim', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        const seenBeforeCreate = [];
        runStep
          .mockImplementationOnce(async () => {
            seenBeforeCreate.push(stdout.output);
          })
          .mockRejectedValueOnce(new Error('stop after the creation'));

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          api: [inspectOk()],
          std: [
            { out: `This project is for ${LABEL}.` },
            { out: `Creating this project for ${LABEL} (confirmed with --yes).` },
            { not: CLAIM },
          ],
          exitMessage: 'stop after the creation',
        });

        expect(createSteps()).toStrictEqual([
          [process.argv[1], 'projects:create:sql', 'app', '--invitation', CLAIM],
        ]);
        expect(seenBeforeCreate[0]).toContain(`This project is for ${LABEL}.`);
      });

      it('refuses --invitation without --flow, before logging in or asking the server', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--invitation', CLAIM],
          env,
          exitMessage:
            'Without a terminal, --invitation needs a flow: add --flow standalone or --flow inapp.',
        });

        expect(runStep).not.toHaveBeenCalled();
      });

      it('refuses --invitation without --yes, before logging in or asking the server', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
          env,
          exitMessage:
            'Without a terminal, --invitation cannot ask before creating the project for the inviter: add --yes to confirm.',
        });

        expect(runStep).not.toHaveBeenCalled();
      });

      it('proceeds with an explicit --flow demo', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          api: [inspectOk()],
          std: [{ out: 'Demo back-office live.' }, { not: CLAIM }],
        });

        expect(createSteps()).toHaveLength(1);
        expect(createSteps()[0]).toContain(CLAIM);
      });
    });

    describe('on a terminal', () => {
      const question = {
        type: 'confirm',
        name: 'value',
        message: `Create this project for ${LABEL}?`,
        default: false,
      };

      it('creates nothing when the answer is no, the default', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        const tty = forceTty();
        try {
          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
            env,
            token: 'valid-token',
            api: [inspectOk()],
            prompts: [{ in: [question], out: { value: false } }],
            std: [
              { out: `This project is for ${LABEL}.` },
              { out: 'Nothing was created.' },
              { not: CLAIM },
            ],
          });
        } finally {
          tty.mockRestore();
        }

        expect(runStep).not.toHaveBeenCalled();
        expect(runCapture).not.toHaveBeenCalled();
      });

      it('takes --yes as the answer, without asking', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        runStep.mockRejectedValueOnce(new Error('stop after the creation'));

        const tty = forceTty();
        try {
          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM, '--yes'],
            env,
            token: 'valid-token',
            api: [inspectOk()],
            std: [
              { out: `Creating this project for ${LABEL} (confirmed with --yes).` },
              { not: CLAIM },
            ],
            exitMessage: 'stop after the creation',
          });
        } finally {
          tty.mockRestore();
        }

        expect(createSteps()).toStrictEqual([
          [process.argv[1], 'projects:create:sql', 'app', '--invitation', CLAIM],
        ]);
      });

      it('creates the project with the claim after a yes', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        runStep
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('stop after the creation'));

        const tty = forceTty();
        try {
          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
            env,
            token: 'valid-token',
            api: [inspectOk()],
            prompts: [{ in: [question], out: { value: true } }],
            std: [{ not: CLAIM }],
            exitMessage: 'stop after the creation',
          });
        } finally {
          tty.mockRestore();
        }

        expect(createSteps()).toStrictEqual([
          [process.argv[1], 'projects:create:sql', 'app', '--invitation', CLAIM],
        ]);
      });

      it('names the server in a warning before the check and in the question when it is not the default', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        let warnedBeforeRequest = false;
        const tty = forceTty();
        try {
          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
            env: { ...env, FOREST_URL_IS_DEFAULT: false },
            token: 'valid-token',
            api: [
              () =>
                nock(SERVER)
                  .post(INSPECT, { claim: CLAIM })
                  .reply(() => {
                    warnedBeforeRequest = stdout.output.includes(
                      'This invitation will be sent to http://localhost:3001.',
                    );

                    return [200, { inviter: ADA, project: null }];
                  }),
            ],
            prompts: [
              {
                in: [
                  {
                    ...question,
                    message: `Create this project for ${LABEL} on http://localhost:3001?`,
                  },
                ],
                out: { value: false },
              },
            ],
            std: [{ out: 'Nothing was created.' }],
          });
        } finally {
          tty.mockRestore();
        }

        expect(warnedBeforeRequest).toBe(true);
      });
    });

    describe('when the server does not give a clean go', () => {
      it('points to logout then login on a claim for another account, without logging out', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        const logout = jest.fn();
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM, '--yes'],
          env,
          additionnalStep: plan =>
            plan.replace('services/authenticator/authenticator', {
              getAuthToken: () => 'valid-token',
              login: () => {},
              logout,
              tryLogin: () => {},
            }),
          api: [refusal(403, 'developer_invitation_claim_wrong_account', 'nope')],
          exitMessage:
            'This invitation was accepted with another Forest account. Run `forest logout`, then ' +
            '`forest login` with the invited account, and run this command again.',
        });

        expect(logout).not.toHaveBeenCalled();
        expect(createSteps()).toStrictEqual([]);
      });

      it.each([
        [
          'expired',
          refusal(422, 'developer_invitation_claim_expired', 'It expired.'),
          'It expired.',
        ],
        ['revoked', refusal(422, 'developer_invitation_claim_revoked', 'Revoked.'), 'Revoked.'],
        ['consumed', refusal(422, 'developer_invitation_claim_consumed', 'Used.'), 'Used.'],
        [
          'invalid, with the claim echoed',
          refusal(422, 'developer_invitation_claim_invalid', `Unknown ${CLAIM}`),
          'Unknown <redacted>',
        ],
        [
          'a session that expired',
          inspect(401, {}),
          'Your session is no longer valid. Run `forest login`, then this command again.',
        ],
        [
          'a server without the route',
          inspect(404, {}),
          'This Forest server does not support developer invitations.',
        ],
        [
          'rate limited',
          inspect(429, {}, { 'Retry-After': '30' }),
          'Too many invitation checks. Try again in 30 seconds.',
        ],
        [
          'a server error',
          inspect(500, {}),
          'Could not check this invitation with Forest (HTTP 500). Nothing was created. Try again in a moment.',
        ],
        [
          'a network error',
          () => nock(SERVER).post(INSPECT).replyWithError(`socket hang up ${CLAIM}`),
          'Could not check this invitation with Forest (no answer). Nothing was created. Try again in a moment.',
        ],
        [
          'a 202 instead of a 200',
          inspect(202, { inviter: ADA, project: null }),
          'Could not check this invitation with Forest (HTTP 202). Nothing was created. Try again in a moment.',
        ],
        [
          'an answer without the inviter email',
          inspect(200, { inviter: { name: 'Ada' }, project: null }),
          'The Forest server sent an unexpected answer about this invitation. Nothing was created.',
        ],
        [
          'an answer with a malformed project',
          inspect(200, { inviter: ADA, project: { id: 7 } }),
          'The Forest server sent an unexpected answer about this invitation. Nothing was created.',
        ],
      ])('stops before any creation on %s', async (_, api, message) => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          api: [api],
          exitMessage: message,
        });

        expect(createSteps()).toStrictEqual([]);
      });

      it.each([
        ['an empty value', ''],
        ['a short value', 'a'.repeat(21)],
        ['a value with a space', `${'a'.repeat(15)} ${'a'.repeat(15)}`],
        ['a shell command', `${'a'.repeat(15)};rm${'a'.repeat(10)}`],
      ])('refuses %s before logging in, without echoing it', async (_, value) => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo', `--invitation=${value}`],
          env,
          exitMessage:
            'The --invitation value is not a valid invitation claim. Copy the command again from the invitation page.',
        });

        expect(runStep).not.toHaveBeenCalled();
      });

      it('refuses a claim also passed to another flag, before logging in', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', CLAIM, '--invitation', CLAIM, '--yes'],
          env,
          exitMessage:
            'Pass the invitation claim once, to --invitation only. Copy the command again from the invitation page.',
        });

        expect(runStep).not.toHaveBeenCalled();
      });

      it.each([
        ['a stray positional', [CLAIM]],
        ['a mistyped flag', [`--invitaton=${CLAIM}`]],
        ['a long flag glued to its value', [`--invitation${CLAIM}`]],
      ])(
        'never echoes a claim passed as %s',
        async (_, args) => {
          expect.hasAssertions();
          resetProcessMocks();

          const error = await StartCommand.run(['--dry-run', '--flow', 'demo', ...args]).catch(
            thrown => thrown,
          );

          expect(error.message).toContain('<redacted>');
          expect(error.message).not.toContain(CLAIM);
          expect(error.stack).not.toContain(CLAIM);
        },
        30000,
      );
    });

    describe('when the claim already started a project', () => {
      const resumed = name => inspectOk({ inviter: ADA, project: { id: '42', name } });

      it.each([
        ['demo', ['--flow', 'demo'], 'projects:create:demo'],
        ['standalone', ['--flow', 'standalone'], 'projects:create:sql'],
        [
          'in-app Node',
          ['--flow', 'inapp', '--stack', 'node', '--mount', 'manual'],
          'projects:create:in-app',
        ],
        ['in-app Rails', ['--flow', 'inapp', '--stack', 'rails'], 'projects:create:in-app'],
      ])('resumes that project under its name in the %s flow', async (_, args, step) => {
        expect.hasAssertions();
        resetProcessMocks();
        runStep.mockRejectedValueOnce(new Error('stop after the creation'));
        runCapture.mockRejectedValueOnce(new Error('stop after the creation'));

        await testCli({
          commandClass: StartCommand,
          commandArgs: [...args, '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          files: [PACKAGE_JSON],
          api: [resumed('invited-app')],
          std: [
            { out: 'Resuming the project invited-app this invitation started.' },
            { not: CLAIM },
          ],
          exitMessage: 'stop after the creation',
        });

        expect(createSteps().map(command => command.slice(1, 3))).toStrictEqual([
          [step, 'invited-app'],
        ]);
      });

      it.each(['../x', '-H', 'a/b', '.', '‮app'])(
        'stops on an unusable resumed name %p, spawning nothing',
        async name => {
          expect.hasAssertions();
          resetProcessMocks();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--invitation', CLAIM, '--yes'],
            env,
            token: 'valid-token',
            api: [resumed(name)],
            exitMessage:
              'Forest returned a project name this CLI cannot use as a directory. Nothing was created.',
          });

          expect(runStep).not.toHaveBeenCalled();
        },
      );

      it('stops when --name names another project', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'other', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          api: [resumed('invited-app')],
          exitMessage:
            'This invitation already started the project invited-app, not other. Run the command again without --name.',
        });

        expect(createSteps()).toStrictEqual([]);
      });

      it.each(['standalone', 'demo'])(
        'stops in the %s flow when the scaffold directory of the resumed project already exists',
        async flow => {
          expect.hasAssertions();
          resetProcessMocks();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', flow, '--invitation', CLAIM, '--yes'],
            env,
            token: 'valid-token',
            files: [{ name: 'invited-app/package.json', content: '{}' }],
            api: [resumed('invited-app')],
            exitMessage:
              './invited-app already exists. Remove it, or finish the setup of invited-app by hand.',
          });

          expect(createSteps()).toStrictEqual([]);
        },
      );
    });

    describe('in the output of a failing creation', () => {
      it('redacts the claim from a failing create:sql', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        runStep.mockImplementationOnce(async (command, args) => {
          throw new Error(`\`${args.join(' ')}\` exited with code 1\n${CLAIM} refused`);
        });

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM, '--yes'],
          env,
          token: 'valid-token',
          api: [inspectOk()],
          std: [{ not: CLAIM }],
          exitMessage: `\`${process.argv[1]} projects:create:sql app --invitation <redacted>\` exited with code 1\n<redacted> refused`,
        });
      });

      it('redacts the claim from the streamed output and the error of a failing create:in-app', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        runCapture.mockImplementationOnce(async (command, args, { onProgress }) => {
          onProgress(`progress for ${CLAIM}\n`);
          throw new Error(`create failed\nchild said ${CLAIM}`);
        });

        await testCli({
          commandClass: StartCommand,
          commandArgs: [
            '--flow',
            'inapp',
            '--stack',
            'node',
            '--name',
            'app',
            '--mount',
            'manual',
            '--invitation',
            CLAIM,
            '--yes',
          ],
          env,
          token: 'valid-token',
          files: [PACKAGE_JSON],
          api: [inspectOk()],
          std: [{ out: 'progress for <redacted>' }, { not: CLAIM }],
          exitMessage: 'create failed\nchild said <redacted>',
        });
      });

      it('redacts the claim from both attempts when --format json is unknown', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        runCapture
          .mockRejectedValueOnce(new Error('cmd\nNonexistent flag: --format'))
          .mockRejectedValueOnce(new Error(`retry failed ${CLAIM}`));

        await testCli({
          commandClass: StartCommand,
          commandArgs: [
            '--flow',
            'inapp',
            '--stack',
            'node',
            '--name',
            'app',
            '--mount',
            'manual',
            '--invitation',
            CLAIM,
            '--yes',
          ],
          env,
          token: 'valid-token',
          files: [PACKAGE_JSON],
          api: [inspectOk()],
          std: [{ not: CLAIM }],
          exitMessage: 'retry failed <redacted>',
        });
      });
    });
  });
});
