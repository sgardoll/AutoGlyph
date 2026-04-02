import { LetterBox } from './fontGenerator';

export function pointInLetterBox(
  letter: LetterBox,
  normalizedX: number,
  normalizedY: number,
) {
  const [ymin, xmin, ymax, xmax] = letter.box;

  return normalizedX >= xmin / 1000 && normalizedX <= xmax / 1000 && normalizedY >= ymin / 1000 && normalizedY <= ymax / 1000;
}

export function createManualLetterBox(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): LetterBox | null {
  const xmin = Math.min(startX, endX);
  const xmax = Math.max(startX, endX);
  const ymin = Math.min(startY, endY);
  const ymax = Math.max(startY, endY);

  if (xmax - xmin < 0.01 || ymax - ymin < 0.01) {
    return null;
  }

  return {
    id: `manual-${Date.now()}`,
    char: '?',
    box: [Math.round(ymin * 1000), Math.round(xmin * 1000), Math.round(ymax * 1000), Math.round(xmax * 1000)],
  };
}
