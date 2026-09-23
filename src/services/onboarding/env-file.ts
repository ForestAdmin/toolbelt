import fs from 'fs';

export type SecretsWrite = {
  file: string;
  written: string[];
  conflicts: string[];
};

/**
 * Put the secrets where the app reads them from, rather than on the terminal. Existing values
 * are left alone: overwriting a secret the user already configured would be worse than not
 * writing at all.
 */
export function writeSecrets(secrets: { envSecret?: string; authSecret?: string }): SecretsWrite {
  const file = '.env';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const written: string[] = [];
  const conflicts: string[] = [];
  const appended: string[] = [];
  let content = current;

  Object.entries({
    FOREST_ENV_SECRET: secrets.envSecret,
    FOREST_AUTH_SECRET: secrets.authSecret,
  }).forEach(([key, value]) => {
    if (!value) return;

    const assignment = new RegExp(`^${key}=(.*)$`, 'm');
    const existing = assignment.exec(content)?.[1]?.trim();

    if (existing === undefined) {
      appended.push(`${key}=${value}`);
      written.push(key);
    } else if (existing === '') {
      // A placeholder, not a configured value. Filled IN PLACE: appending would leave the file
      // with the same key twice, which reads as a mistake even though dotenv takes the last.
      content = content.replace(assignment, `${key}=${value}`);
      written.push(key);
    } else if (existing !== value) {
      // A DIFFERENT secret is already there: overwriting it would break whatever it belongs to,
      // and staying silent would leave the app pointing at another project while we report
      // success. Neither is acceptable, so it is surfaced.
      conflicts.push(key);
    }
  });

  if (content !== current || appended.length) {
    const separator = content && !content.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(
      file,
      appended.length ? `${content}${separator}${appended.join('\n')}\n` : content,
      // Applies only when the file is created: the secrets are for the user alone.
      { mode: 0o600 },
    );
  }

  return { file, written, conflicts };
}

/**
 * The secrets to hand the first boot, so it runs against the same project as every restart after.
 * A key `.env` kept for another project is left to `.env`, as `reportSecrets` told the user.
 */
export function bootSecrets(
  secrets: { envSecret?: string; authSecret?: string },
  { conflicts }: Pick<SecretsWrite, 'conflicts'>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      FOREST_ENV_SECRET: secrets.envSecret,
      FOREST_AUTH_SECRET: secrets.authSecret,
      // An empty value is not a neutral default: it SHADOWS what dotenv would load from `.env`.
    }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]) && !conflicts.includes(entry[0]),
    ),
  );
}
