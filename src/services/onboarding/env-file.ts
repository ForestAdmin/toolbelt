import dotenv from 'dotenv';
import fs from 'fs';

type Secrets = { envSecret?: string; authSecret?: string };

export type SecretsWrite = {
  file: string;
  written: string[];
  conflicts: string[];
  /** Keys the shell already exports: dotenv never overrides them, so `.env` is not what runs. */
  shadowed: string[];
  /** Written, but still readable by others: its mode could not be restricted. */
  exposed: boolean;
};

const keyed = (secrets: Secrets) =>
  Object.entries({
    FOREST_ENV_SECRET: secrets.envSecret,
    FOREST_AUTH_SECRET: secrets.authSecret,
  });

/**
 * The assignment the app's dotenv would actually load for `key`: it accepts `export` and spaces
 * around `=`, keeps a quoted value whole, ends an unquoted one at its first `#`, and keeps the LAST
 * of several.
 */
function effectiveAssignment(content: string, key: string) {
  const pattern = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=(.*)$`, 'gm');
  const last = [...content.matchAll(pattern)].pop();
  if (!last) return undefined;

  const raw = last[1].trim();
  const quoted = /^(['"`])(.*?)\1\s*(?:#.*)?$/.exec(raw);

  return {
    value: quoted ? quoted[2] : raw.replace(/#.*$/, '').trim(),
    start: last.index as number,
    end: (last.index as number) + last[0].length,
  };
}

/**
 * Also on a file that existed: the secrets written into it are new, and nobody chose to let other
 * local users read them. A file owned by someone else refuses, which is reported and never fatal,
 * since the secrets are already in it and the project already exists.
 */
function restrictToOwner(file: string): boolean {
  try {
    fs.chmodSync(file, 0o600);

    return true;
  } catch {
    return false;
  }
}

/**
 * Put the secrets where the app reads them from, rather than on the terminal. Existing values
 * are left alone: overwriting a secret the user already configured would be worse than not
 * writing at all.
 */
export function writeSecrets(
  secrets: Secrets,
  environment: NodeJS.ProcessEnv = process.env,
): SecretsWrite {
  const file = '.env';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const written: string[] = [];
  const conflicts: string[] = [];
  const appended: string[] = [];
  let content = current;

  keyed(secrets).forEach(([key, value]) => {
    if (!value) return;

    const existing = effectiveAssignment(content, key);

    if (existing === undefined) {
      appended.push(`${key}=${value}`);
      written.push(key);
    } else if (existing.value === '') {
      // A placeholder, not a configured value. Filled IN PLACE: appending would leave the file
      // with the same key twice, which reads as a mistake even though dotenv takes the last.
      content = `${content.slice(0, existing.start)}${key}=${value}${content.slice(existing.end)}`;
      written.push(key);
    } else if (existing.value !== value) {
      // A DIFFERENT secret is already there: overwriting it would break whatever it belongs to,
      // and staying silent would leave the app pointing at another project while we report
      // success. Neither is acceptable, so it is surfaced.
      conflicts.push(key);
    }
  });

  let exposed = false;

  if (content !== current || appended.length) {
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(
      file,
      appended.length ? `${content}${separator}${appended.join('\n')}\n` : content,
    );
    exposed = !restrictToOwner(file);
  }

  const shadowed = keyed(secrets)
    .filter(([key, value]) => value && environment[key] !== undefined)
    .map(([key]) => key);

  return { file, written, conflicts, shadowed, exposed };
}

/**
 * The keys this CLI's own dotenv loaded from the user's `.env` when it started. That dotenv is
 * v8, which reads comments, backticks and multi-line values differently from the app's, so its
 * values must not reach the app: they would win over the `.env` the app reads itself. Read before
 * `writeSecrets` changes the file, since it compares against what was loaded.
 */
export function keysLoadedFromDotenv(
  file = '.env',
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  try {
    const parsed = dotenv.parse(fs.readFileSync(file));

    return Object.keys(parsed).filter(key => environment[key] === parsed[key]);
  } catch {
    return []; // no .env, so this CLI loaded nothing
  }
}

/**
 * The secrets to hand the first boot, so it runs against the same project as every restart after.
 * A key `.env` kept for another project, or one the shell exports, is left where restarts read it.
 */
export function bootSecrets(
  secrets: Secrets,
  { conflicts, shadowed }: Pick<SecretsWrite, 'conflicts' | 'shadowed'>,
): Record<string, string> {
  return Object.fromEntries(
    // An empty value is not a neutral default: it SHADOWS what dotenv would load from `.env`.
    keyed(secrets).filter(
      (entry): entry is [string, string] =>
        Boolean(entry[1]) && !conflicts.includes(entry[0]) && !shadowed.includes(entry[0]),
    ),
  );
}
