import { contours } from 'd3-contour';
import opentype from 'opentype.js';

export type LetterBox = {
  id: string;
  char: string;
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
};

function getCharMetrics(char: string) {
  if (/[A-PR-Z]/.test(char)) return { align: 'bottom', targetY: 0, targetH: 700 };
  if (char === 'Q') return { align: 'top', targetY: 700, targetH: 900 };
  if (/[aceimnorsuvwxz]/.test(char)) return { align: 'bottom', targetY: 0, targetH: 500 };
  if (/[bdfhklt]/.test(char)) return { align: 'bottom', targetY: 0, targetH: 750 };
  if (/[gpqy]/.test(char)) return { align: 'top', targetY: 500, targetH: 750 };
  if (char === 'j') return { align: 'top', targetY: 750, targetH: 1000 };
  // fallback
  return { align: 'bottom', targetY: 0, targetH: 500 };
}

function getSignedArea(ring: number[][]) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    area += (p1[0] * p2[1] - p2[0] * p1[1]);
  }
  return area / 2;
}

const round = (n: number) => Math.round(n * 100) / 100;

function createGlyphPath(imageData: ImageData, char: string, isDarkText: boolean) {
  const { width, height, data } = imageData;
  const values = new Array(width * height).fill(0);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      
      const isInk = isDarkText ? (lum < 150 && a > 128) : (lum > 128 && a > 128);
      
      if (isInk) {
        values[y * width + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        values[y * width + x] = 0;
      }
    }
  }

  if (maxX < minX) return null;

  const inkWidth = maxX - minX + 1;
  const inkHeight = maxY - minY + 1;

  const metrics = getCharMetrics(char);
  const scale = metrics.targetH / inkHeight;
  
  let fontTop, fontBottom;
  if (metrics.align === 'bottom') {
    fontBottom = metrics.targetY;
    fontTop = fontBottom + metrics.targetH;
  } else {
    fontTop = metrics.targetY;
    fontBottom = fontTop - metrics.targetH;
  }

  const leftSideBearing = 50;
  const path = new opentype.Path();
  
  const multiPolygons = contours().size([width, height]).thresholds([0.5])(values);
  
  multiPolygons.forEach(multiPolygon => {
    multiPolygon.coordinates.forEach(polygon => {
      polygon.forEach((ring, ringIndex) => {
        const fontRing = ring.map(([imgX, imgY]) => {
          const fontX = (imgX - minX) * scale + leftSideBearing;
          const fontY = fontTop - (imgY - minY) * scale;
          return [fontX, fontY];
        });

        const area = getSignedArea(fontRing);
        const isClockwise = area < 0;
        const isOuter = ringIndex === 0;
        const needsClockwise = isOuter;

        if (isClockwise !== needsClockwise) {
          fontRing.reverse();
        }

        for (let i = 0; i < fontRing.length; i++) {
          const [x, y] = fontRing[i];
          if (i === 0) {
            path.moveTo(round(x), round(y));
          } else {
            path.lineTo(round(x), round(y));
          }
        }
        path.close();
      });
    });
  });

  const advanceWidth = inkWidth * scale + leftSideBearing * 2;

  return { path, advanceWidth };
}

export function generateFont(
  imageElement: HTMLImageElement,
  letters: LetterBox[],
  isDarkText: boolean,
  fontName: string = 'My Custom Font'
) {
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(imageElement, 0, 0);

  const glyphsData: { char: string, path: opentype.Path, advanceWidth: number }[] = [];

  for (const letter of letters) {
    const [ymin, xmin, ymax, xmax] = letter.box;
    const x = Math.floor((xmin / 1000) * canvas.width);
    const y = Math.floor((ymin / 1000) * canvas.height);
    const w = Math.ceil(((xmax - xmin) / 1000) * canvas.width);
    const h = Math.ceil(((ymax - ymin) / 1000) * canvas.height);

    if (w <= 0 || h <= 0) continue;

    const imageData = ctx.getImageData(x, y, w, h);
    const glyphData = createGlyphPath(imageData, letter.char, isDarkText);
    if (glyphData) {
      glyphsData.push({ char: letter.char, ...glyphData });
    }
  }

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 500,
    path: new opentype.Path()
  });

  const glyphs = [notdefGlyph];

  glyphsData.forEach(data => {
    if (data.char.length !== 1) return;
    const unicode = data.char.charCodeAt(0);
    const glyph = new opentype.Glyph({
      name: data.char,
      unicode: unicode,
      advanceWidth: data.advanceWidth,
      path: data.path
    });
    glyphs.push(glyph);
  });

  const font = new opentype.Font({
    familyName: fontName,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: glyphs
  });

  font.download();
}
