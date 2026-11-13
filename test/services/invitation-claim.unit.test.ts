import { Errors } from '@oclif/core';

import {
  INVALID_CLAIM_MESSAGE,
  inspectionFailure,
  invitationRefusal,
  inviterLabel,
  isClaimRepeated,
  isSafeProjectName,
  isWellFormedClaim,
  maskClaimsInParseError,
  parseInspection,
  sanitizeForDisplay,
  withoutClaimsInCliError,
} from '../../src/services/invitation-claim';

const SENTINEL = 'SENTINELclaimAAAAAAAAAAAAAAAAAAAA';

function httpError(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return Object.assign(new Error('HTTP error'), { status, response: { body, headers } });
}

function refusalError(code: string, detail?: string, status = 422) {
  return httpError(status, { errors: [{ status, detail, meta: { code } }] });
}

describe('services > invitation-claim', () => {
  describe('isWellFormedClaim', () => {
    it.each([
      ['22 characters', 'a'.repeat(22)],
      ['256 characters', 'a'.repeat(256)],
      ['the base64url alphabet', `Ab0-_${'x'.repeat(20)}`],
      ['the sentinel', SENTINEL],
    ])('accepts %s', (_, value) => {
      expect.hasAssertions();
      expect(isWellFormedClaim(value)).toBe(true);
    });

    it.each([
      ['empty', ''],
      ['21 characters', 'a'.repeat(21)],
      ['257 characters', 'a'.repeat(257)],
      ['a leading dash', `-${'a'.repeat(30)}`],
      ['a leading underscore', `_${'a'.repeat(30)}`],
      ['a space', `${'a'.repeat(15)} ${'a'.repeat(15)}`],
      ['spaces only', ' '.repeat(30)],
      ['a semicolon', `${'a'.repeat(15)};rm${'a'.repeat(10)}`],
      ['a URL', 'https://app.forestadmin.com/invitations/abc'],
      ['a trailing newline', `${'a'.repeat(30)}\n`],
      ['a non-string', 42],
      ['undefined', undefined],
    ])('refuses %s', (_, value) => {
      expect.hasAssertions();
      expect(isWellFormedClaim(value)).toBe(false);
    });

    it('never echoes the value in its refusal message', () => {
      expect.hasAssertions();
      expect(INVALID_CLAIM_MESSAGE).not.toContain(SENTINEL);
    });
  });

  describe('maskClaimsInParseError', () => {
    it('masks a claim passed as a stray positional', () => {
      expect.hasAssertions();
      expect(
        maskClaimsInParseError(`Unexpected argument: ${SENTINEL}`, ['--flow', 'demo', SENTINEL]),
      ).toBe('Unexpected argument: <redacted>');
    });

    it('masks the value of a mistyped flag in its = form, and the whole token', () => {
      expect.hasAssertions();

      const token = `--invitaton=${SENTINEL}`;

      expect(
        maskClaimsInParseError(`Nonexistent flag: ${token}\nSee more help`, [token]),
      ).not.toContain(SENTINEL);
    });

    it('masks a claim glued to a short flag', () => {
      expect.hasAssertions();
      expect(
        maskClaimsInParseError(`Expected --language=${SENTINEL} to be one of: js, ts`, [
          'app',
          `-l${SENTINEL}`,
        ]),
      ).toBe('Expected --language=<redacted> to be one of: js, ts');
    });

    it('leaves a message without claims untouched', () => {
      expect.hasAssertions();
      expect(maskClaimsInParseError('Nonexistent flag: --x', ['--x', 'demo'])).toBe(
        'Nonexistent flag: --x',
      );
    });
  });

  describe('withoutClaimsInCliError', () => {
    const parseError = (message: string) =>
      Object.assign(new Errors.CLIError(message, { exit: 2 }), { parse: {} });

    it('rebuilds a parse error so neither its message nor its stack carries the claim', () => {
      expect.hasAssertions();

      const masked = withoutClaimsInCliError(parseError(`Unexpected argument: ${SENTINEL}`), [
        SENTINEL,
      ]) as Errors.CLIError;

      expect(masked.message).toBe('Unexpected argument: <redacted>');
      expect(masked.stack).not.toContain(SENTINEL);
      expect(masked.oclif.exit).toBe(2);
    });

    it('keeps a parse error without a claim as it is', () => {
      expect.hasAssertions();

      const error = parseError('Nonexistent flag: --x');

      expect(withoutClaimsInCliError(error, ['--x'])).toBe(error);
    });

    it('masks an oclif flag-value error too, which carries no parse details', () => {
      expect.hasAssertions();

      const masked = withoutClaimsInCliError(
        new Errors.CLIError(`Expected an integer but received: ${SENTINEL}`),
        ['--projectId', SENTINEL],
      ) as Errors.CLIError;

      expect(masked.message).not.toContain(SENTINEL);
      expect(masked.stack).not.toContain(SENTINEL);
    });

    it('leaves an error that does not come from oclif alone', () => {
      expect.hasAssertions();

      const error = new Error(`Cannot reach ${SENTINEL}`);

      expect(withoutClaimsInCliError(error, [SENTINEL])).toBe(error);
    });
  });

  describe('isClaimRepeated', () => {
    it.each([
      [['--invitation', SENTINEL], false],
      [[`--invitation=${SENTINEL}`], false],
      [['--name', SENTINEL, '--invitation', SENTINEL], true],
      [[`--db=postgres://u:${SENTINEL}@h/d`, '--invitation', SENTINEL], true],
    ])('says %p repeats the claim: %p', (argv, expected) => {
      expect.hasAssertions();
      expect(isClaimRepeated(argv, SENTINEL)).toBe(expected);
    });
  });

  describe('sanitizeForDisplay', () => {
    it.each([
      ['an ANSI clear screen', 'a\x1b[2Jb'],
      ['a carriage return', 'a\rb'],
      ['a newline', 'a\nb'],
      ['a right-to-left override', 'a\u202Eb'],
      ['a zero-width space', 'a\u200Bb'],
      ['a word joiner', 'a\u2060b'],
      ['an Arabic letter mark', 'a\u061Cb'],
      ['a soft hyphen', 'a\u00ADb'],
      ['a tag character', 'a\u{E0041}b'],
      ['a private-use character', 'a\uE000b'],
      ['a lone surrogate', 'a\uD800b'],
      ['a line separator', 'a\u2028b'],
      ['a paragraph separator', 'a\u2029b'],
    ])('removes %s', (_, input) => {
      expect.hasAssertions();

      const output = sanitizeForDisplay(input, 80);

      expect(output).toMatch(/^a ?(\[2J)?b$/);
      expect(output).not.toMatch(/[\p{C}\u2028\u2029]/u);
    });

    it('keeps at most two combining marks in a row', () => {
      expect.hasAssertions();
      expect(sanitizeForDisplay(`e${'\u0301'.repeat(50)}x`, 80)).toBe('e\u0301\u0301x');
    });

    it('collapses whitespace and trims', () => {
      expect.hasAssertions();
      expect(sanitizeForDisplay('  Ada \t\n  Lovelace  ', 80)).toBe('Ada Lovelace');
    });

    it('cuts by code point, never inside a surrogate pair', () => {
      expect.hasAssertions();

      const output = sanitizeForDisplay(`${'a'.repeat(79)}\u{1F600}\u{1F600}`, 80);

      expect(output).toBe(`${'a'.repeat(79)}\u{1F600}`);
    });

    it('redacts a claim before cutting, so a claim straddling the cut leaves no prefix', () => {
      expect.hasAssertions();

      const output = sanitizeForDisplay(`${'a'.repeat(70)} ${SENTINEL}`, 80, SENTINEL);

      expect(output).toBe(`${'a'.repeat(70)} <redacted>`.slice(0, 80));
      expect(output).not.toContain(SENTINEL.slice(0, 9));
    });

    it('redacts a claim split by invisible characters', () => {
      expect.hasAssertions();

      const split = `${SENTINEL.slice(0, 10)}\u200B${SENTINEL.slice(10)}`;

      expect(sanitizeForDisplay(`x ${split}`, 300, SENTINEL)).toBe('x <redacted>');
    });
  });

  describe('inviterLabel', () => {
    it('puts the email first, then the name', () => {
      expect.hasAssertions();
      expect(inviterLabel({ email: 'ada@example.com', name: 'Ada Lovelace' })).toBe(
        'ada@example.com (Ada Lovelace)',
      );
    });

    it.each([null, '', '\u200B\u202E'])('shows the email alone when the name is %p', name => {
      expect.hasAssertions();
      expect(inviterLabel({ email: 'ada@example.com', name })).toBe('ada@example.com');
    });

    it('never truncates the email, even when the name is cut', () => {
      expect.hasAssertions();

      const email = `${'a'.repeat(200)}@example.com`;
      const label = inviterLabel({ email, name: 'n'.repeat(200) });

      expect(label).toBe(`${email} (${'n'.repeat(80)})`);
    });

    it('strips control characters from the name', () => {
      expect.hasAssertions();
      expect(inviterLabel({ email: 'a@b.c', name: 'Eve\x1b[2J\u202E' })).toBe('a@b.c (Eve[2J)');
    });
  });

  describe('parseInspection', () => {
    const inviter = { name: 'Ada', email: 'ada@example.com' };

    it('accepts an answer without a project', () => {
      expect.hasAssertions();
      expect(parseInspection({ inviter, project: null })).toStrictEqual({ inviter, project: null });
    });

    it('accepts an answer with a project to resume and a null name', () => {
      expect.hasAssertions();

      const body = { inviter: { name: null, email: 'a@b.c' }, project: { id: '7', name: 'app' } };

      expect(parseInspection(body)).toStrictEqual(body);
    });

    it.each([
      ['no body', undefined],
      ['no inviter', { project: null }],
      ['no email', { inviter: { name: 'Ada' }, project: null }],
      ['a numeric email', { inviter: { name: 'Ada', email: 1 }, project: null }],
      ['an empty email', { inviter: { name: 'Ada', email: '' }, project: null }],
      ['an invisible email', { inviter: { name: 'Ada', email: '\u200B' }, project: null }],
      [
        'an email longer than 254 characters',
        { inviter: { name: 'Ada', email: `${'a'.repeat(250)}@b.cd` }, project: null },
      ],
      ['a numeric name', { inviter: { name: 1, email: 'a@b.c' }, project: null }],
      ['no project key', { inviter }],
      ['a project without a name', { inviter, project: { id: '7' } }],
      ['a project with a numeric id', { inviter, project: { id: 7, name: 'app' } }],
    ])('refuses %s', (_, body) => {
      expect.hasAssertions();
      expect(() => parseInspection(body)).toThrow('unexpected answer about this invitation');
    });
  });

  describe('isSafeProjectName', () => {
    it.each(['app', 'my back-office', 'a'.repeat(150), 'a'.repeat(214)])('accepts %p', name => {
      expect.hasAssertions();
      expect(isSafeProjectName(name)).toBe(true);
    });

    it.each([
      '../x',
      '-H',
      'a/b',
      'a\\b',
      '.',
      '..',
      '.hidden',
      '',
      'a'.repeat(215),
      'a\nb',
      'a\u202Eb',
      ' padded',
      '\u00E9'.repeat(108),
    ])('refuses %p', name => {
      expect.hasAssertions();
      expect(isSafeProjectName(name)).toBe(false);
    });
  });

  describe('invitationRefusal', () => {
    it('maps the wrong account to the switch-account help, not the server detail', () => {
      expect.hasAssertions();

      const refusal = invitationRefusal(
        refusalError('developer_invitation_claim_wrong_account', 'raw detail', 403),
      );

      expect(refusal?.code).toBe('developer_invitation_claim_wrong_account');
      expect(refusal?.message).toContain('forest logout');
      expect(refusal?.message).toContain('forest login');
      expect(refusal?.message).not.toContain('raw detail');
    });

    it.each(['expired', 'revoked', 'consumed', 'invalid', 'project_mismatch', 'future_reason'])(
      'shows the sanitized detail for %s',
      reason => {
        expect.hasAssertions();
        expect(
          invitationRefusal(
            refusalError(`developer_invitation_claim_${reason}`, `Gone\x1b[2J ${SENTINEL}`),
            SENTINEL,
          ),
        ).toStrictEqual({
          code: `developer_invitation_claim_${reason}`,
          message: 'Gone[2J <redacted>',
        });
      },
    );

    it('falls back to a fixed sentence when the detail is missing', () => {
      expect.hasAssertions();
      expect(invitationRefusal(refusalError('developer_invitation_claim_expired'))?.message).toBe(
        'Forest refused this invitation. Nothing was created.',
      );
    });

    it.each([
      ['a plain error', new Error('boom')],
      ['no response', { status: 500 }],
      ['no body', { response: {} }],
      ['no errors', httpError(422, {})],
      ['empty errors', httpError(422, { errors: [] })],
      ['no meta', httpError(422, { errors: [{ detail: 'x' }] })],
      ['another code', refusalError('project_name_taken')],
      ['a numeric code', httpError(422, { errors: [{ meta: { code: 1 } }] })],
      ['null', null],
    ])('returns null for %s', (_, error) => {
      expect.hasAssertions();
      expect(invitationRefusal(error)).toBeNull();
    });
  });

  describe('inspectionFailure', () => {
    it.each([
      [refusalError('developer_invitation_claim_wrong_account', '', 403), 'forest logout'],
      [refusalError('developer_invitation_claim_expired', 'This invitation expired.'), 'expired'],
      [httpError(401), 'Run `forest login`'],
      [httpError(404), 'does not support developer invitations'],
      [httpError(429, undefined, { 'retry-after': '30' }), 'Try again in 30 seconds'],
      [httpError(429, undefined, { 'retry-after': '999999' }), 'Try again in 3600 seconds'],
      [httpError(429, undefined, { 'retry-after': 'Wed, 21 Oct' }), 'Try again later'],
      [httpError(429), 'Try again later'],
      [httpError(500), 'Could not check this invitation'],
      [Object.assign(new Error(`connect ECONNREFUSED ${SENTINEL}`)), 'Could not check'],
    ])('turns %p into a fixed message', (error, expected) => {
      expect.hasAssertions();

      const failure = inspectionFailure(error, SENTINEL);

      expect(failure.message).toContain(expected);
      expect(failure.message).not.toContain(SENTINEL);
      expect(failure).not.toBe(error);
    });
  });
});
