import fs from 'fs';

export function hasBuildScript(dir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));

    return Boolean(pkg.scripts?.build);
  } catch {
    return false;
  }
}

/**
 * Read the secrets `projects:create:in-app` printed.
 *
 * Two shapes on purpose: the `--format json` document when the CLI supports it, and otherwise
 * the human output, which prints `FOREST_ENV_SECRET=…` ungated for exactly this consumer. The
 * fallback is what makes this work against a CLI that predates the flag rather than dying on
 * `Nonexistent flag: --format`. Output that is not JSON falls through to the human output.
 */
export function parseSecrets(output: string): { envSecret?: string; authSecret?: string } {
  let parsed: { envSecret?: string; authSecret?: string } | undefined;
  try {
    parsed = JSON.parse(output.trim());
  } catch {
    parsed = undefined;
  }
  if (parsed?.envSecret) return parsed;

  return {
    envSecret: /FOREST_ENV_SECRET=(\S+)/.exec(output)?.[1],
    authSecret: /FOREST_AUTH_SECRET=(\S+)/.exec(output)?.[1],
  };
}

/** The port the scaffolded project actually runs on, from its generated .env. */
export function readPort(dir: string): number | undefined {
  try {
    const port = /^APPLICATION_PORT=(\d+)/m.exec(fs.readFileSync(`${dir}/.env`, 'utf8'))?.[1];

    return port ? Number(port) : undefined;
  } catch {
    return undefined;
  }
}
