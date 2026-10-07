import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  findForestProject,
  findForestProjectsIn,
} from '../../../src/services/onboarding/existing-project';

// A helper (not a jest hook) — this repo forbids beforeEach/afterEach (jest/no-hooks).
function withTempDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'existing-project-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function write(dir: string, files: Record<string, string>): void {
  Object.entries(files).forEach(([file, content]) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  });
}

const scaffold = (extra: Record<string, string> = {}) => ({
  '.env': 'FOREST_ENV_SECRET=abc\nAPPLICATION_PORT=3310\n',
  'package.json': JSON.stringify({ dependencies: { '@forestadmin/agent': '^1' } }),
  'index.ts': 'agent.mountOnStandaloneServer(Number(process.env.APPLICATION_PORT));',
  ...extra,
});

describe('onboarding > existing-project', () => {
  describe('findForestProject', () => {
    it('recognises a scaffold by the standalone server it boots, and a demo by its datasource', () => {
      expect.assertions(2);
      withTempDir(dir => {
        write(dir, scaffold());
        expect(findForestProject(dir)).toStrictEqual({
          dir,
          kind: 'scaffold',
          demo: false,
          envSecret: 'abc',
        });

        write(dir, {
          'package.json': JSON.stringify({
            dependencies: {
              '@forestadmin/agent': '^1',
              '@forestadmin/datasource-demo-fintech': '^1',
            },
          }),
        });
        expect(findForestProject(dir)?.demo).toBe(true);
      });
    });

    it('recognises a Node app with Forest mounted on its own framework', () => {
      expect.assertions(1);
      withTempDir(dir => {
        write(dir, {
          '.env': 'FOREST_ENV_SECRET=abc\n',
          'package.json': JSON.stringify({
            dependencies: { '@forestadmin/agent': '^1', express: '^4' },
          }),
          'index.js': 'createAgent(options).mountOnExpress(app).start();',
        });
        expect(findForestProject(dir)?.kind).toBe('node-app');
      });
    });

    it("reads a Rails app's secret from the initializer its generator writes", () => {
      expect.assertions(1);
      withTempDir(dir => {
        write(dir, {
          'config/initializers/forest_admin_rails.rb':
            "ForestAdminRails.configure do |config|\n  config.env_secret = 'from-rails'\nend\n",
        });
        expect(findForestProject(dir)).toMatchObject({
          kind: 'rails-app',
          envSecret: 'from-rails',
        });
      });
    });

    it('ignores a folder without a Forest secret, or without the agent it would boot', () => {
      expect.assertions(2);
      withTempDir(dir => {
        write(dir, scaffold({ '.env': 'DATABASE_URL=postgres://h/db\n' }));
        expect(findForestProject(dir)).toBeNull();

        write(dir, {
          '.env': 'FOREST_ENV_SECRET=abc\n',
          'package.json': JSON.stringify({ dependencies: { express: '^4' } }),
        });
        expect(findForestProject(dir)).toBeNull();
      });
    });
  });

  describe('findForestProjectsIn', () => {
    it('lists the projects of the immediate subfolders, sorted, and skips node_modules', () => {
      expect.assertions(1);
      withTempDir(dir => {
        write(path.join(dir, 'my-shop'), scaffold());
        write(path.join(dir, 'forest-demo-ab12'), scaffold());
        write(path.join(dir, 'node_modules/some-pkg'), scaffold());
        write(path.join(dir, 'notes'), { 'readme.md': 'hello' });

        expect(findForestProjectsIn(dir).map(project => project.dir)).toStrictEqual([
          'forest-demo-ab12',
          'my-shop',
        ]);
      });
    });
  });
});
