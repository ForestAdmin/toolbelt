import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  NODE_DATASOURCE,
  detectNodeStack,
  detectRails,
  mountHelper,
} from '../../../src/services/onboarding/detect';

// Run `fn` inside a throwaway temp dir (cwd), restoring + cleaning up afterwards.
// A helper (not a jest hook) — this repo forbids beforeEach/afterEach (jest/no-hooks).
function withTempDir(run: () => void): void {
  const previousCwd = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-test-'));
  process.chdir(tmp);
  try {
    run();
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const writePkg = (dependencies: Record<string, string>) =>
  fs.writeFileSync('package.json', JSON.stringify({ name: 'app', dependencies }));

describe('onboarding detect', () => {
  describe('detectNodeStack', () => {
    it('falls back to express + sql when there is nothing to read', () => {
      expect.assertions(2);
      withTempDir(() => {
        const stack = detectNodeStack();
        expect(stack).toMatchObject({ framework: 'express', orm: 'sql' });
        // Nothing was actually detected — the caller can tell defaults from findings.
        expect(stack.detected).toBe(false);
      });
    });

    it('prefers the most specific framework, since a NestJS app also depends on express', () => {
      expect.assertions(1);
      withTempDir(() => {
        writePkg({ '@nestjs/core': '^10.0.0', express: '^4.0.0' });
        expect(detectNodeStack().framework).toBe('nestJs');
      });
    });

    it.each([
      ['fastify', 'fastify'],
      ['koa', 'koa'],
      ['express', 'express'],
    ])('detects %s', (dependency, framework) => {
      expect.assertions(1);
      withTempDir(() => {
        writePkg({ [dependency]: '^1.0.0' });
        expect(detectNodeStack().framework).toBe(framework);
      });
    });

    it.each([
      ['sequelize', 'sequelize'],
      ['mongoose', 'mongoose'],
      ['typeorm', 'typeorm'],
      ['@prisma/client', 'prisma'],
      ['prisma', 'prisma'],
    ])('maps %s to the right datasource package', (dependency, orm) => {
      expect.assertions(2);
      withTempDir(() => {
        writePkg({ [dependency]: '^1.0.0' });
        expect(detectNodeStack().orm).toBe(orm);
        expect(NODE_DATASOURCE[orm]).toContain('@forestadmin/datasource-');
      });
    });

    it('reads devDependencies too, where typescript usually lives', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync(
          'package.json',
          JSON.stringify({ name: 'app', devDependencies: { typescript: '^5.0.0' } }),
        );
        expect(detectNodeStack().typescript).toBe(true);
        expect(detectNodeStack().detected).toBe(true);
      });
    });

    it('treats a tsconfig.json as TypeScript even without the dependency', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.writeFileSync('tsconfig.json', '{}');
        expect(detectNodeStack().typescript).toBe(true);
      });
    });

    it('survives an unreadable package.json instead of crashing the onboarding', () => {
      expect.assertions(1);
      withTempDir(() => {
        fs.writeFileSync('package.json', '{ not json');
        expect(detectNodeStack()).toMatchObject({ framework: 'express', detected: false });
      });
    });
  });

  describe('detectRails', () => {
    it('recognises a Gemfile declaring rails, and ignores anything else', () => {
      expect.assertions(3);
      withTempDir(() => {
        expect(detectRails()).toBe(false); // no Gemfile at all

        fs.writeFileSync('Gemfile', "source 'https://rubygems.org'\ngem 'sinatra'\n");
        expect(detectRails()).toBe(false);

        fs.writeFileSync('Gemfile', "source 'https://rubygems.org'\ngem \"rails\", '~> 8.0'\n");
        expect(detectRails()).toBe(true);
      });
    });
  });

  describe('detectRails, commented declarations', () => {
    it('ignores a commented gem line, which records that Rails was NOT used', () => {
      expect.assertions(2);
      withTempDir(() => {
        fs.writeFileSync('Gemfile', "source 'x'\n# gem 'rails', '~> 8.0'\ngem 'sinatra'\n");
        expect(detectRails()).toBe(false);

        // …while an indented but live declaration still counts.
        fs.writeFileSync('Gemfile', "group :default do\n  gem 'rails'\nend\n");
        expect(detectRails()).toBe(true);
      });
    });
  });

  describe('mountHelper', () => {
    it('capitalises the framework for mountOn<Framework>, keeping NestJs casing', () => {
      expect.assertions(3);
      expect(mountHelper('nestJs')).toBe('NestJs');
      expect(mountHelper('express')).toBe('Express');
      expect(mountHelper('fastify')).toBe('Fastify');
    });
  });
});
