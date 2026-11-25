import type { Chalk } from 'chalk';

/**
 * The Forest beaver, running over the `forest start` progress bar while a step loads, and
 * breathing once nothing does. Pure functions only: OnboardingUI decides when and where to draw.
 *
 * The sprite is the one from the beaver game, copied pixel for pixel (20 x 14 virtual pixels, the
 * game's empty top row cropped). Two pixels stack in one character cell with half blocks, so it
 * is drawn 20 columns wide and 7 rows high.
 */

/** One row of pixels per string: `.` is transparent, any other character is a palette key. */
export type Sprite = string[];

/** A character cell: a half block and the colour keys of its two pixels. */
export type Cell = { char: string; fg?: string; bg?: string };

export type MascotMode = 'run' | 'breathe';

// Brand palette only: the beaver is lime on the terminal's own background.
export const PALETTE: Record<string, string> = { '#': '#ddf327' };

// Run frame A: tail straight up, legs spread. Also the standing pose.
const FRAME_A: Sprite = [
  '....................',
  '.....##.............',
  '.....##.............',
  '.....##.............',
  '.....##.............',
  '.....##.............',
  '.....##.............',
  '.....##........#...#',
  '.......############.',
  '.......##########.#.',
  '.......############.',
  '.......############.',
  '........#.....#...#.',
  '........##....##....',
];

// Run frame B: tail leaning left, legs together, snout tip one pixel back.
const FRAME_B: Sprite = [
  '....................',
  '.....#..............',
  '....##..............',
  '....##..............',
  '....##..............',
  '....###.............',
  '.....##.............',
  '.....##........#..#.',
  '.......############.',
  '.......##########.#.',
  '.......############.',
  '.......############.',
  '.........#...#....#.',
  '.........##..##.....',
];

// The body's top row: what is above it (back, ear, snout tip, tail) rises when breathing in.
const BODY_TOP = 8;

export const SPRITE_WIDTH = FRAME_A[0].length;
export const SPRITE_ROWS = Math.ceil(FRAME_A.length / 2);
export const LAP_MS = 3000;
export const STRIDE_MS = 160;
export const BREATH_MS = 2500;
// Narrower than this, the track is too short for a 20-column beaver to read as running.
export const MIN_COLUMNS = 60;

/** The breath in: everything above the body moves up one pixel, so the back grows by one. */
export function inhale(sprite: Sprite): Sprite {
  return sprite.map((row, index) => (index < BODY_TOP ? sprite[index + 1] : row));
}

const BREATH_IN = inhale(FRAME_A);

/** The frame at a given time: alternating strides while running, a slow breath when standing. */
export function pose(mode: MascotMode, elapsedMs: number): Sprite {
  if (mode === 'run') return Math.floor(elapsedMs / STRIDE_MS) % 2 ? FRAME_B : FRAME_A;

  return elapsedMs % BREATH_MS < BREATH_MS / 2 ? FRAME_A : BREATH_IN;
}

/**
 * The sprite's left column on the track: one lap every LAP_MS, from fully off the left edge to
 * its last column on the right one, then around again.
 */
export function position(elapsedMs: number, track: number, spriteWidth = SPRITE_WIDTH): number {
  const span = track + spriteWidth;

  return Math.floor(((elapsedMs % LAP_MS) / LAP_MS) * span) - spriteWidth;
}

/** One character cell from its two pixels, top and bottom. */
function halfBlock(top: string, bottom: string): Cell {
  if (top === '.' && bottom === '.') return { char: ' ' };
  if (top === '.') return { char: '▄', fg: bottom };
  if (bottom === '.') return { char: '▀', fg: top };
  if (bottom === top) return { char: '█', fg: top };

  return { char: '▀', fg: top, bg: bottom };
}

/** Pairs of pixel rows as half-block cells: `▀` top only, `▄` bottom only, `█` both. */
export function halfBlocks(sprite: Sprite): Cell[][] {
  const rows: Cell[][] = [];
  for (let top = 0; top < sprite.length; top += 2) {
    const upper = sprite[top];
    const lower = sprite[top + 1] ?? '.'.repeat(upper.length);
    rows.push([...upper].map((key, column) => halfBlock(key, lower[column])));
  }

  return rows;
}

/** The cells laid on a track `width` columns wide at column `x`, cut at both edges. */
export function placed(cells: Cell[][], x: number, width: number): Cell[][] {
  return cells.map(row =>
    Array.from({ length: width }, (_, column) => row[column - x] ?? { char: ' ' }),
  );
}

/** Rows of cells as coloured text, one escape sequence per run of same-coloured cells. */
export function paint(rows: Cell[][], ink: Chalk, palette = PALETTE): string[] {
  return rows.map(row => {
    let text = '';
    let run = '';
    let style: Cell | undefined;
    const flush = () => {
      if (!run) return;
      let brush: Chalk | undefined;
      if (style?.fg) brush = ink.hex(palette[style.fg]);
      if (style?.bg) brush = (brush ?? ink).bgHex(palette[style.bg]);
      text += brush ? brush(run) : run;
      run = '';
    };
    row.forEach(cell => {
      if (cell.fg !== style?.fg || cell.bg !== style?.bg) {
        flush();
        style = cell;
      }
      run += cell.char;
    });
    flush();

    return text;
  });
}

/** The beaver as it should be drawn now: `SPRITE_ROWS` lines, each `track` columns wide. */
export function mascotRows(
  mode: MascotMode,
  elapsedMs: number,
  track: number,
  ink: Chalk,
  standAt = track - SPRITE_WIDTH,
): string[] {
  const x = mode === 'run' ? position(elapsedMs, track) : standAt;

  return paint(placed(halfBlocks(pose(mode, elapsedMs)), x, track), ink);
}

/**
 * Whether the beaver is drawn at all. Off when colours are off or poor (NO_COLOR, which chalk 4
 * ignores, or fewer than 256 colours), on request (FOREST_NO_MASCOT=1), and when the window is too
 * narrow or too short for the live region plus the beaver and a margin.
 */
export function mascotEnabled({
  level,
  env,
  columns,
  rows,
  height = 0,
}: {
  level: number;
  env: NodeJS.ProcessEnv;
  columns?: number;
  rows?: number;
  height?: number;
}): boolean {
  if (env.NO_COLOR) return false;
  if (env.FOREST_NO_MASCOT && env.FOREST_NO_MASCOT !== '0') return false;
  if (level < 2) return false;
  if ((columns ?? 0) < MIN_COLUMNS) return false;

  return (rows ?? 0) >= height + SPRITE_ROWS + 2;
}

// ---------- the end menu's keys ----------

export type MenuKey = 'up' | 'down' | 'enter' | 'cancel';

/** The keys in one chunk of raw stdin: arrows (and j / k), Enter, Ctrl-C. Others are dropped. */
export function menuKeys(chunk: string): MenuKey[] {
  const keys: MenuKey[] = [];
  // eslint-disable-next-line no-control-regex
  const tokens = chunk.match(/\x1b\[[0-9;]*[A-Za-z]|\x1bO[A-Za-z]|[\s\S]/g) ?? [];
  tokens.forEach(token => {
    if (token === '\x1b[A' || token === '\x1bOA' || token === 'k') keys.push('up');
    else if (token === '\x1b[B' || token === '\x1bOB' || token === 'j') keys.push('down');
    else if (token === '\r' || token === '\n') keys.push('enter');
    else if (token === '\x03') keys.push('cancel');
  });

  return keys;
}

/** The highlighted choice after one key, wrapping around both ends like inquirer's lists. */
export function menuMove(index: number, count: number, key: MenuKey): number {
  if (key === 'up') return (index - 1 + count) % count;
  if (key === 'down') return (index + 1) % count;

  return index;
}
