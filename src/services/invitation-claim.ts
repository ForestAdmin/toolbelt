import { Errors } from '@oclif/core';

export type Inviter = { name: string | null; email: string };

export type Inspection = {
  inviter: Inviter;
  project: { id: string; name: string } | null;
};

export type Refusal = { code: string; message: string };

const CLAIM = /^[A-Za-z0-9][A-Za-z0-9_-]{21,255}$/;
const REFUSAL_PREFIX = 'developer_invitation_claim_';
const WRONG_ACCOUNT = `${REFUSAL_PREFIX}wrong_account`;
const REDACTED = '<redacted>';
const MAX_EMAIL_LENGTH = 254;
const MAX_RETRY_AFTER_SECONDS = 3600;

export const MAX_NAME_LENGTH = 80;
export const MAX_PROJECT_NAME_LENGTH = 214;
export const MAX_DETAIL_LENGTH = 300;

export const INVALID_CLAIM_MESSAGE =
  'The --invitation value is not a valid invitation claim. Copy the command again from the invitation page.';

const WRONG_ACCOUNT_MESSAGE =
  'This invitation was accepted with another Forest account. Run `forest logout`, then ' +
  '`forest login` with the invited account, and run this command again.';
const REFUSAL_FALLBACK_MESSAGE = 'Forest refused this invitation. Nothing was created.';
const MALFORMED_ANSWER_MESSAGE =
  'The Forest server sent an unexpected answer about this invitation. Nothing was created.';
const SESSION_EXPIRED_MESSAGE =
  'Your session is no longer valid. Run `forest login`, then this command again.';
const UNSUPPORTED_SERVER_MESSAGE = 'This Forest server does not support developer invitations.';
const UNREACHABLE_MESSAGE =
  'Could not check this invitation with Forest. Nothing was created. Try again in a moment.';

export function isWellFormedClaim(value: unknown): value is string {
  return typeof value === 'string' && CLAIM.test(value);
}

function redact(text: string, claims: string[]): string {
  return claims.reduce((result, claim) => result.split(claim).join(REDACTED), text);
}

export function maskClaimsInParseError(message: string, argv: string[]): string {
  const claims = argv
    .flatMap(token => [token, token.slice(token.indexOf('=') + 1), token.replace(/^-\w/, '')])
    .filter(isWellFormedClaim)
    .sort((a, b) => b.length - a.length);

  return redact(message, claims);
}

export function withoutClaimsInCliError(error: unknown, argv: string[]): unknown {
  if (!(error instanceof Errors.CLIError)) return error;

  const message = maskClaimsInParseError(error.message, argv);

  return message === error.message
    ? error
    : new Errors.CLIError(message, { exit: error.oclif.exit ?? 2 });
}

export const REPEATED_CLAIM_MESSAGE =
  'Pass the invitation claim once, to --invitation only. Copy the command again from the invitation page.';

export function isClaimRepeated(argv: string[], claim: string): boolean {
  return argv.join('\n').split(claim).length > 2;
}

export function sanitizeForDisplay(text: string, maxLength: number, claim?: string): string {
  const visible = text.replace(/\s+/gu, ' ').replace(/\p{C}/gu, '');
  const cleaned = (claim ? redact(visible, [claim]) : visible)
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();

  return Array.from(cleaned).slice(0, maxLength).join('');
}

export function inviterLabel(inviter: Inviter, claim?: string): string {
  const email = sanitizeForDisplay(inviter.email, MAX_EMAIL_LENGTH, claim);
  const name = inviter.name ? sanitizeForDisplay(inviter.name, MAX_NAME_LENGTH, claim) : '';

  return name ? `${email} (${name})` : email;
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function isValidEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length <= MAX_EMAIL_LENGTH &&
    sanitizeForDisplay(email, MAX_EMAIL_LENGTH) !== ''
  );
}

function parseProject(project: unknown): Inspection['project'] | undefined {
  if (project === null) return null;

  const id = field(project, 'id');
  const name = field(project, 'name');

  return typeof id === 'string' && typeof name === 'string' ? { id, name } : undefined;
}

export function parseInspection(body: unknown): Inspection {
  const inviter = field(body, 'inviter');
  const email = field(inviter, 'email');
  const name = field(inviter, 'name');
  const project = parseProject(field(body, 'project'));
  const nameIsValid = name === null || typeof name === 'string';

  if (!isValidEmail(email) || !nameIsValid || project === undefined) {
    throw new Error(MALFORMED_ANSWER_MESSAGE);
  }

  return { inviter: { email, name: name as string | null }, project };
}

export function isSafeProjectName(name: string): boolean {
  return (
    name !== '' &&
    Buffer.byteLength(name) <= MAX_PROJECT_NAME_LENGTH &&
    sanitizeForDisplay(name, MAX_PROJECT_NAME_LENGTH) === name &&
    !/[/\\]/.test(name) &&
    !/^[-.]/.test(name)
  );
}

function firstError(error: unknown): unknown {
  const errors = field(field(field(error, 'response'), 'body'), 'errors');

  return Array.isArray(errors) ? errors[0] : undefined;
}

export function invitationRefusal(error: unknown, claim?: string): Refusal | null {
  const first = firstError(error);
  const code = field(field(first, 'meta'), 'code');

  if (typeof code !== 'string' || !code.startsWith(REFUSAL_PREFIX)) return null;
  if (code === WRONG_ACCOUNT) return { code, message: WRONG_ACCOUNT_MESSAGE };

  const detail = field(first, 'detail');
  const message =
    typeof detail === 'string' ? sanitizeForDisplay(detail, MAX_DETAIL_LENGTH, claim) : '';

  return { code, message: message || REFUSAL_FALLBACK_MESSAGE };
}

function retryAfterSeconds(error: unknown): number | null {
  const header = field(field(field(error, 'response'), 'headers'), 'retry-after');

  if (typeof header !== 'string' || !/^\d+$/.test(header.trim())) return null;

  return Math.min(Number(header.trim()), MAX_RETRY_AFTER_SECONDS);
}

function rateLimitMessage(error: unknown): string {
  const seconds = retryAfterSeconds(error);

  return seconds === null
    ? 'Too many invitation checks. Try again later.'
    : `Too many invitation checks. Try again in ${seconds} seconds.`;
}

export function inspectionFailure(error: unknown, claim: string): Error {
  const refusal = invitationRefusal(error, claim);
  if (refusal) return new Error(refusal.message);

  const status = field(error, 'status');
  if (status === 401) return new Error(SESSION_EXPIRED_MESSAGE);
  if (status === 404) return new Error(UNSUPPORTED_SERVER_MESSAGE);
  if (status === 429) return new Error(rateLimitMessage(error));

  return new Error(UNREACHABLE_MESSAGE);
}
