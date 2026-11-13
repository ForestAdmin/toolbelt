const fs = require('fs');
const nock = require('nock');
const { stdout } = require('stdout-stderr');

const StartCommand = require('../../src/commands/start').default;
const { runCapture, runStep, startProcess } = require('../../src/services/process-runner');
const testCli = require('./test-cli-helper/test-cli');

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
          commandArgs: ['--dry-run', ...args, '--invitation', CLAIM],
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
          commandArgs: ['--dry-run', '--flow', 'demo', '--invitation', CLAIM],
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
          commandArgs: ['--flow', 'demo', '--invitation', CLAIM],
          env: { ...env, SILENT: '1' },
          token: 'valid-token',
          api: [inspectOk()],
          std: [
            { out: `Creating this project for ${LABEL} (non-interactive, not asking).` },
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
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
          env,
          token: 'valid-token',
          api: [inspectOk()],
          std: [
            { out: `This project is for ${LABEL}.` },
            { out: `Creating this project for ${LABEL} (non-interactive, not asking).` },
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

      it('proceeds with an explicit --flow demo', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo', '--invitation', CLAIM],
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
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
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
          'Could not check this invitation with Forest. Nothing was created. Try again in a moment.',
        ],
        [
          'a network error',
          () => nock(SERVER).post(INSPECT).replyWithError(`socket hang up ${CLAIM}`),
          'Could not check this invitation with Forest. Nothing was created. Try again in a moment.',
        ],
        [
          'a 202 instead of a 200',
          inspect(202, { inviter: ADA, project: null }),
          'Could not check this invitation with Forest. Nothing was created. Try again in a moment.',
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
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
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

      it.each([
        ['a stray positional', [CLAIM]],
        ['a mistyped flag', [`--invitaton=${CLAIM}`]],
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

      it('resumes that project under its name, whatever flow runs', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo', '--invitation', CLAIM],
          env,
          token: 'valid-token',
          api: [resumed('invited-app')],
          std: [
            { out: 'Resuming the project invited-app this invitation started.' },
            { not: CLAIM },
          ],
        });

        expect(createSteps()[0].slice(0, 3)).toStrictEqual([
          process.argv[1],
          'projects:create:demo',
          'invited-app',
        ]);
      });

      it.each(['../x', '-H', 'a/b', '.', '‮app'])(
        'stops on an unusable resumed name %p, spawning nothing',
        async name => {
          expect.hasAssertions();
          resetProcessMocks();

          await testCli({
            commandClass: StartCommand,
            commandArgs: ['--flow', 'standalone', '--invitation', CLAIM],
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
          commandArgs: ['--flow', 'standalone', '--name', 'other', '--invitation', CLAIM],
          env,
          token: 'valid-token',
          api: [resumed('invited-app')],
          exitMessage:
            'This invitation already started the project invited-app, not other. Run the command again without --name.',
        });

        expect(createSteps()).toStrictEqual([]);
      });

      it('stops when the scaffold directory of the resumed project already exists', async () => {
        expect.hasAssertions();
        resetProcessMocks();

        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--invitation', CLAIM],
          env,
          token: 'valid-token',
          files: [{ name: 'invited-app/package.json', content: '{}' }],
          api: [resumed('invited-app')],
          exitMessage:
            './invited-app already exists. Remove it, or finish the setup of invited-app by hand.',
        });

        expect(createSteps()).toStrictEqual([]);
      });
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
          commandArgs: ['--flow', 'standalone', '--name', 'app', '--invitation', CLAIM],
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
