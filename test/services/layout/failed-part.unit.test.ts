import { failedPartLine, readFailedPart } from '../../../src/services/layout/failed-part';

describe('failed part', () => {
  it.each(['layout', 'folders', 'workflows'] as const)(
    'reads %s back from the line layout:apply prints',
    part => {
      expect.assertions(1);

      const output = `× ${failedPartLine(part)} — Server error (402): Feature is not active\n`;

      expect(readFailedPart(output)).toBe(part);
    },
  );

  it('finds no part in an error that does not carry the line', () => {
    expect.assertions(1);

    expect(
      readFailedPart('`forest layout:apply` exited with code 1:\nSession expired'),
    ).toBeUndefined();
  });
});
