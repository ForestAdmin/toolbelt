/**
 * Values that must never reach the terminal, a scrollback or a CI log. The echo is a feature —
 * it teaches what the wrapper does — but a database URL carries credentials and an env secret is
 * a long-lived one, so what is shown and what is run are not the same string.
 */
function isHidden(command: string, args: string[], index: number): boolean {
  const previous = args[index - 1];

  return (
    previous === '--databaseConnectionURL' ||
    previous === '-c' ||
    previous === '--invitation' ||
    (command === 'bin/rails' && previous === 'forest_admin_rails:install')
  );
}

export function redact(command: string, args: string[]): string {
  const shown = args.map((arg, index) => (isHidden(command, args, index) ? '<redacted>' : arg));

  return `${command} ${shown.join(' ')}`.trim();
}

export function masked(text: string, command: string, args: string[]): string {
  return args
    .filter((_, index) => isHidden(command, args, index))
    .reduce((result, value) => result.split(value).join('<redacted>'), text);
}

/**
 * The same values, out of a failure's message. The runner only knows secret-named flags and URL
 * userinfo, so a bare positional or a URL's `?password=` would otherwise print in the clear.
 */
export function scrubbed(error: unknown, command: string, args: string[]): Error {
  return new Error(masked((error as Error).message, command, args));
}
