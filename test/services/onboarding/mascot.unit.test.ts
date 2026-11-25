import chalk from 'chalk';

import {
  BREATH_MS,
  LAP_MS,
  PALETTE,
  SPRITE_ROWS,
  SPRITE_WIDTH,
  STRIDE_MS,
  halfBlocks,
  inhale,
  mascotEnabled,
  mascotRows,
  menuKeys,
  menuMove,
  paint,
  placed,
  pose,
  position,
} from '../../../src/services/onboarding/mascot';

// The beaver game's drawBeaverShape fills, replayed on a 20 x 15 grid, top two rows cropped
// to one: the sprite must match them pixel for pixel.
function fromGame(frame: 'A' | 'B'): string[] {
  const grid = Array.from({ length: 15 }, () => Array(20).fill('.'));
  const fill = (c: number, r: number, w = 1, h = 1, value = '#') => {
    for (let y = r; y < r + h; y += 1) for (let x = c; x < c + w; x += 1) grid[y][x] = value;
  };
  if (frame === 'A') fill(5, 2, 2, 7);
  else {
    fill(5, 2);
    fill(4, 3, 2, 3);
    fill(4, 6, 3, 1);
    fill(5, 7, 2, 2);
  }
  fill(15, 8);
  fill(frame === 'A' ? 19 : 18, 8);
  fill(7, 9, 12, 4);
  fill(17, 10, 1, 1, '.');
  fill(18, 13);
  const leg = frame === 'A' ? [8, 14] : [9, 13];
  leg.forEach(c => {
    fill(c, 13);
    fill(c, 14, 2, 1);
  });

  return grid.slice(1).map(row => row.join(''));
}

const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, ''); // eslint-disable-line no-control-regex

const env = {} as NodeJS.ProcessEnv;
const roomy = { level: 3, env, columns: 100, rows: 50, height: 20 };

describe('mascot', () => {
  describe('frames', () => {
    it('should copy both run frames from the game, pixel for pixel', () => {
      expect.assertions(2);

      expect(pose('run', 0)).toStrictEqual(fromGame('A'));
      expect(pose('run', STRIDE_MS)).toStrictEqual(fromGame('B'));
    });

    it('should draw 20 columns by 7 rows using only the lime of the palette', () => {
      expect.assertions(4);

      const cells = halfBlocks(pose('run', 0));

      expect(cells).toHaveLength(SPRITE_ROWS);
      expect(cells.every(row => row.length === SPRITE_WIDTH)).toBe(true);
      expect(new Set(cells.flat().map(cell => cell.fg && PALETTE[cell.fg]))).toStrictEqual(
        new Set([undefined, '#ddf327']),
      );
      expect(new Set(cells.flat().map(cell => cell.char))).toStrictEqual(
        new Set([' ', '▀', '▄', '█']),
      );
    });

    it('should leave the eye as a hole showing the terminal background', () => {
      expect.assertions(1);

      // Game pixel (17, 10) is row 9 once cropped: the bottom half of cell row 4.
      expect(halfBlocks(pose('run', 0))[4][17]).toStrictEqual({ char: '▀', fg: '#' });
    });
  });

  describe('pose', () => {
    it('should alternate the two strides every STRIDE_MS while running', () => {
      expect.assertions(3);

      expect(pose('run', STRIDE_MS - 1)).toBe(pose('run', 0));
      expect(pose('run', STRIDE_MS)).not.toBe(pose('run', 0));
      expect(pose('run', 2 * STRIDE_MS)).toBe(pose('run', 0));
    });

    it('should stand in the frame A pose and breathe in for half of each breath', () => {
      expect.assertions(4);

      expect(pose('breathe', 0)).toStrictEqual(fromGame('A'));
      expect(pose('breathe', BREATH_MS / 2)).toStrictEqual(inhale(fromGame('A')));
      expect(pose('breathe', BREATH_MS - 1)).toStrictEqual(inhale(fromGame('A')));
      expect(pose('breathe', BREATH_MS)).toStrictEqual(fromGame('A'));
    });

    it('should only raise the back, ear and tail by one pixel when breathing in', () => {
      expect.assertions(4);

      const rest = pose('breathe', 0);
      const held = pose('breathe', BREATH_MS / 2);

      // Rows from the body's top down do not move; everything above moves up one pixel.
      expect(held.slice(8)).toStrictEqual(rest.slice(8));
      expect(held.slice(0, 8)).toStrictEqual(rest.slice(1, 9));
      // The tail tip now reaches the top pixel row, still inside the 7 cell rows.
      expect(halfBlocks(rest)[0][5]).toStrictEqual({ char: '▄', fg: '#' });
      expect(halfBlocks(held)[0][5]).toStrictEqual({ char: '█', fg: '#' });
    });
  });

  describe('position', () => {
    it('should start fully off the left edge and end on the last column of the track', () => {
      expect.assertions(2);

      expect(position(0, 72)).toBe(-SPRITE_WIDTH);
      expect(position(LAP_MS - 1, 72)).toBe(71);
    });

    it('should wrap around after each lap', () => {
      expect.assertions(2);

      expect(position(LAP_MS, 72)).toBe(position(0, 72));
      expect(position(LAP_MS + LAP_MS / 2, 72)).toBe(position(LAP_MS / 2, 72));
    });
  });

  describe('placed', () => {
    const cells = halfBlocks(pose('run', 0));
    const text = (rows: ReturnType<typeof placed>) =>
      rows.map(row => row.map(cell => cell.char).join(''));

    it('should keep every row as wide as the track', () => {
      expect.assertions(2);

      expect(placed(cells, -5, 30).every(row => row.length === 30)).toBe(true);
      expect(placed(cells, 25, 30).every(row => row.length === 30)).toBe(true);
    });

    it('should cut the columns that are off the left edge', () => {
      expect.assertions(1);

      expect(text(placed(cells, -15, 30))).toStrictEqual(
        text(cells).map(row => `${row.slice(15)}${' '.repeat(25)}`),
      );
    });

    it('should cut the columns that are off the right edge', () => {
      expect.assertions(1);

      expect(text(placed(cells, 25, 30))).toStrictEqual(
        text(cells).map(row => `${' '.repeat(25)}${row.slice(0, 5)}`),
      );
    });
  });

  describe('paint', () => {
    it('should colour the beaver in lime and leave transparent cells unstyled', () => {
      expect.assertions(3);

      const ink = new chalk.Instance({ level: 3 });
      const [row] = paint([halfBlocks(pose('run', 0))[4]], ink);

      expect(strip(row)).toBe('       ██████████▀█ ');
      expect(row.startsWith('       \x1b[38;2;221;243;39m')).toBe(true);
      expect(row.endsWith('\x1b[39m ')).toBe(true);
    });

    it('should paint plain text without colours', () => {
      expect.assertions(1);

      const ink = new chalk.Instance({ level: 0 });

      expect(paint(halfBlocks(pose('run', 0)), ink)[4]).toBe('       ██████████▀█ ');
    });

    it('should give a cell of two colours a background', () => {
      expect.assertions(1);

      const ink = new chalk.Instance({ level: 3 });

      expect(paint([[{ char: '▀', fg: '#', bg: '#' }]], ink)[0]).toBe(
        '\x1b[38;2;221;243;39m\x1b[48;2;221;243;39m▀\x1b[49m\x1b[39m',
      );
    });

    it('should stand at the given column when breathing, and run along the track', () => {
      expect.assertions(3);

      const ink = new chalk.Instance({ level: 0 });

      expect(mascotRows('breathe', 0, 40, ink)[4]).toBe(`${' '.repeat(27)}██████████▀█ `);
      expect(mascotRows('breathe', 0, 40, ink, 0)[4]).toBe(`       ██████████▀█ ${' '.repeat(20)}`);
      expect(mascotRows('run', 0, 40, ink).join('')).toBe(' '.repeat(40 * SPRITE_ROWS));
    });
  });

  describe('mascotEnabled', () => {
    it('should show the beaver on a roomy 256-colour terminal', () => {
      expect.assertions(1);

      expect(mascotEnabled(roomy)).toBe(true);
    });

    it('should hide it when NO_COLOR or FOREST_NO_MASCOT is set', () => {
      expect.assertions(4);

      expect(mascotEnabled({ ...roomy, env: { NO_COLOR: '1' } })).toBe(false);
      expect(mascotEnabled({ ...roomy, env: { NO_COLOR: '' } })).toBe(true);
      expect(mascotEnabled({ ...roomy, env: { FOREST_NO_MASCOT: '1' } })).toBe(false);
      expect(mascotEnabled({ ...roomy, env: { FOREST_NO_MASCOT: '0' } })).toBe(true);
    });

    it('should hide it below 256 colours', () => {
      expect.assertions(2);

      expect(mascotEnabled({ ...roomy, level: 1 })).toBe(false);
      expect(mascotEnabled({ ...roomy, level: 2 })).toBe(true);
    });

    it('should hide it on a narrow window', () => {
      expect.assertions(3);

      expect(mascotEnabled({ ...roomy, columns: 59 })).toBe(false);
      expect(mascotEnabled({ ...roomy, columns: 60 })).toBe(true);
      expect(mascotEnabled({ ...roomy, columns: undefined })).toBe(false);
    });

    it('should hide it when the region, the beaver and a margin do not fit', () => {
      expect.assertions(2);

      expect(mascotEnabled({ ...roomy, rows: 20 + SPRITE_ROWS + 1 })).toBe(false);
      expect(mascotEnabled({ ...roomy, rows: 20 + SPRITE_ROWS + 2 })).toBe(true);
    });
  });

  describe('menu keys', () => {
    it('should read arrows, j / k, Enter and Ctrl-C, and drop the rest', () => {
      expect.assertions(3);

      expect(menuKeys('\x1b[A\x1b[B\x1bOA\x1bOB')).toStrictEqual(['up', 'down', 'up', 'down']);
      expect(menuKeys('kjx\r\n')).toStrictEqual(['up', 'down', 'enter', 'enter']);
      expect(menuKeys('\x03\x1b[C\x1b')).toStrictEqual(['cancel']);
    });

    it('should move the highlight and wrap around both ends', () => {
      expect.assertions(4);

      expect(menuMove(0, 4, 'down')).toBe(1);
      expect(menuMove(3, 4, 'down')).toBe(0);
      expect(menuMove(0, 4, 'up')).toBe(3);
      expect(menuMove(2, 4, 'enter')).toBe(2);
    });
  });
});
