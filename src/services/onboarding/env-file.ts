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
    );
  }

  return { file, written, conflicts };
}
