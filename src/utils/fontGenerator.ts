import { contours } from 'd3-contour';
import opentype from 'opentype.js';

export type LetterBox = {
  id: string;
  char: string;
  box: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-1000)
};

export type FontMetrics = {
  ascender: number;
  descender: number;
  xHeight: number;
  capHeight: number;
};

export const DEFAULT_METRICS: FontMetrics = {
  ascender: 800,
  descender: -200,
  xHeight: 500,
  capHeight: 700,
};

function getCharMetrics(char: string, metrics: FontMetrics) {
  // Numerals
  if (/[0-9]/.test(char)) return { align: 'bottom', targetY: 0, targetH: metrics.capHeight };

  // Uppercase
  if (/[A-Z]/.test(char)) {
    if (char === 'Q') return { align: 'top', targetY: metrics.capHeight, targetH: metrics.capHeight - metrics.descender };
    return { align: 'bottom', targetY: 0, targetH: metrics.capHeight };
  }

  // Lowercase with descenders
  if (/[gpqy]/.test(char)) return { align: 'top', targetY: metrics.xHeight, targetH: metrics.xHeight - metrics.descender };
  if (char === 'j') return { align: 'top', targetY: metrics.ascender, targetH: metrics.ascender - metrics.descender };

  // Lowercase with ascenders
  if (/[bdfhklt]/.test(char)) return { align: 'bottom', targetY: 0, targetH: metrics.ascender };

  // Lowercase x-height
  if (/[aceimnorsuvwxz]/.test(char)) return { align: 'bottom', targetY: 0, targetH: metrics.xHeight };

  // Punctuation
  if (/[.,]/.test(char)) return { align: 'bottom', targetY: 0, targetH: metrics.xHeight * 0.2 };
  if (/[!?'"]/.test(char)) return { align: 'top', targetY: metrics.capHeight, targetH: metrics.capHeight };

  // fallback
  return { align: 'bottom', targetY: 0, targetH: metrics.xHeight };
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

function createGlyphPath(imageData: ImageData, char: string, isDarkText: boolean, metrics: FontMetrics) {
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

  const charMetrics = getCharMetrics(char, metrics);
  const scale = charMetrics.targetH / inkHeight;

  let fontTop, fontBottom;
  if (charMetrics.align === 'bottom') {
    fontBottom = charMetrics.targetY;
    fontTop = fontBottom + charMetrics.targetH;
  } else {
    fontTop = charMetrics.targetY;
    fontBottom = fontTop - charMetrics.targetH;
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

export function createFont(
  imageElement: HTMLImageElement,
  letters: LetterBox[],
  isDarkText: boolean,
  fontName: string = 'My Custom Font',
  metrics: FontMetrics,
  kerningPairs: { left: string, right: string, value: number }[] = []
): opentype.Font {
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
    const glyphData = createGlyphPath(imageData, letter.char, isDarkText, metrics);
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
    ascender: metrics.ascender,
    descender: metrics.descender,
    description: kerningPairs.length > 0 ? `Kerning Pairs: ${JSON.stringify(kerningPairs)}` : undefined,
    glyphs: glyphs
  });

  const glyphsCollection = font.glyphs as unknown as Record<string, unknown>;
  const internalGlyphs = glyphsCollection.glyphs;

  if (internalGlyphs && typeof internalGlyphs === 'object') {
    for (let i = 0; i < glyphs.length; i++) {
      if (internalGlyphs[i] === undefined) {
        internalGlyphs[i] = glyphs[i];
      }
    }
  }

  // Workaround for opentype.js bug where stringToGlyphs calls glyphs.get(null)
  const originalCharToGlyphIndex = font.charToGlyphIndex.bind(font);
  font.charToGlyphIndex = function(c: string) {
    const index = originalCharToGlyphIndex(c);
    return index !== null ? index : 0;
  };

  // Inject kerning pairs so opentype.js can use them for getPath/draw
  font.kerningPairs = {};
  for (const pair of kerningPairs) {
    const leftGlyphIndex = font.charToGlyphIndex(pair.left);
    const rightGlyphIndex = font.charToGlyphIndex(pair.right);
    if (leftGlyphIndex > 0 && rightGlyphIndex > 0) {
      font.kerningPairs[`${leftGlyphIndex},${rightGlyphIndex}`] = pair.value;
    }
  }

  return font;
}

function createKernTable(pairs: { left: string, right: string, value: number }[], font: opentype.Font) {
  const indexPairs = pairs.map(p => ({
    left: font.charToGlyphIndex(p.left),
    right: font.charToGlyphIndex(p.right),
    value: p.value
  })).filter(p => p.left > 0 && p.right > 0);

  indexPairs.sort((a, b) => {
    if (a.left !== b.left) return a.left - b.left;
    return a.right - b.right;
  });

  const nPairs = indexPairs.length;
  if (nPairs === 0) return null;

  const searchRange = Math.pow(2, Math.floor(Math.log2(nPairs))) * 6;
  const entrySelector = Math.floor(Math.log2(nPairs));
  const rangeShift = (nPairs * 6) - searchRange;

  const subtableLength = 14 + nPairs * 6;
  const tableLength = 4 + subtableLength;

  const buffer = new ArrayBuffer(tableLength);
  const view = new DataView(buffer);

  view.setUint16(0, 0);
  view.setUint16(2, 1);
  view.setUint16(4, 0);
  view.setUint16(6, subtableLength);
  view.setUint16(8, 0x0001);
  view.setUint16(10, nPairs);
  view.setUint16(12, searchRange);
  view.setUint16(14, entrySelector);
  view.setUint16(16, rangeShift);

  let offset = 18;
  for (const pair of indexPairs) {
    view.setUint16(offset, pair.left);
    view.setUint16(offset + 2, pair.right);
    view.setInt16(offset + 4, pair.value);
    offset += 6;
  }

  return new Uint8Array(buffer);
}

function injectTable(originalBuffer: ArrayBuffer, tag: string, tableData: Uint8Array) {
  const originalView = new DataView(originalBuffer);
  const numTables = originalView.getUint16(4);

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16;
    const tableTag = String.fromCharCode(
      originalView.getUint8(offset),
      originalView.getUint8(offset + 1),
      originalView.getUint8(offset + 2),
      originalView.getUint8(offset + 3)
    );
    tables.push({
      tag: tableTag,
      checkSum: originalView.getUint32(offset + 4),
      offset: originalView.getUint32(offset + 8),
      length: originalView.getUint32(offset + 12)
    });
  }

  let newTableCheckSum = 0;
  const paddedLength = (tableData.length + 3) & ~3;
  const paddedData = new Uint8Array(paddedLength);
  paddedData.set(tableData);
  const paddedView = new DataView(paddedData.buffer);
  for (let i = 0; i < paddedLength; i += 4) {
    newTableCheckSum = (newTableCheckSum + paddedView.getUint32(i)) >>> 0;
  }

  tables.push({
    tag: tag,
    checkSum: newTableCheckSum,
    offset: 0,
    length: tableData.length,
    data: paddedData
  } as any);

  tables.sort((a, b) => a.tag.localeCompare(b.tag));

  let currentOffset = 12 + tables.length * 16;
  for (const table of tables) {
    (table as any).newOffset = currentOffset;
    if ((table as any).data) {
      currentOffset += (table as any).data.length;
    } else {
      const oldPaddedLength = (table.length + 3) & ~3;
      currentOffset += oldPaddedLength;
    }
  }

  const newBuffer = new ArrayBuffer(currentOffset);
  const newView = new DataView(newBuffer);
  const newBytes = new Uint8Array(newBuffer);
  const originalBytes = new Uint8Array(originalBuffer);

  newBytes.set(originalBytes.subarray(0, 12));
  newView.setUint16(4, tables.length);

  const searchRange = Math.pow(2, Math.floor(Math.log2(tables.length))) * 16;
  const entrySelector = Math.floor(Math.log2(tables.length));
  const rangeShift = tables.length * 16 - searchRange;
  newView.setUint16(6, searchRange);
  newView.setUint16(8, entrySelector);
  newView.setUint16(10, rangeShift);

  let dirOffset = 12;
  for (const table of tables) {
    newView.setUint8(dirOffset, table.tag.charCodeAt(0));
    newView.setUint8(dirOffset + 1, table.tag.charCodeAt(1));
    newView.setUint8(dirOffset + 2, table.tag.charCodeAt(2));
    newView.setUint8(dirOffset + 3, table.tag.charCodeAt(3));

    newView.setUint32(dirOffset + 4, table.checkSum);
    newView.setUint32(dirOffset + 8, (table as any).newOffset);
    newView.setUint32(dirOffset + 12, table.length);

    if ((table as any).data) {
      newBytes.set((table as any).data, (table as any).newOffset);
    } else {
      const oldPaddedLength = (table.length + 3) & ~3;
      newBytes.set(originalBytes.subarray(table.offset, table.offset + oldPaddedLength), (table as any).newOffset);
    }

    dirOffset += 16;
  }

  const headTable = tables.find(t => t.tag === 'head');
  if (headTable) {
    newView.setUint32((headTable as any).newOffset + 8, 0);
    let fontCheckSum = 0;
    for (let i = 0; i < newBuffer.byteLength; i += 4) {
      fontCheckSum = (fontCheckSum + newView.getUint32(i)) >>> 0;
    }
    const checkSumAdjustment = (0xB1B0AFBA - fontCheckSum) >>> 0;
    newView.setUint32((headTable as any).newOffset + 8, checkSumAdjustment);
  }

  return newBuffer;
}

function wrapInWoff(sfntBuffer: ArrayBuffer): ArrayBuffer {
  const sfntView = new DataView(sfntBuffer);
  const numTables = sfntView.getUint16(4);

  const woffHeaderSize = 44;
  const woffDirSize = numTables * 20;

  let totalWoffSize = woffHeaderSize + woffDirSize;

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16;
    const tag = sfntView.getUint32(offset);
    const checkSum = sfntView.getUint32(offset + 4);
    const tableOffset = sfntView.getUint32(offset + 8);
    const length = sfntView.getUint32(offset + 12);

    const paddedLength = (length + 3) & ~3;

    tables.push({
      tag, checkSum, offset: tableOffset, length, paddedLength
    });

    totalWoffSize += paddedLength;
  }

  const woffBuffer = new ArrayBuffer(totalWoffSize);
  const woffView = new DataView(woffBuffer);
  const woffBytes = new Uint8Array(woffBuffer);
  const sfntBytes = new Uint8Array(sfntBuffer);

  woffView.setUint32(0, 0x774F4646); // 'wOFF'
  woffView.setUint32(4, sfntView.getUint32(0)); // flavor
  woffView.setUint32(8, totalWoffSize);
  woffView.setUint16(12, numTables);
  woffView.setUint16(14, 0);
  woffView.setUint32(16, sfntBuffer.byteLength);
  woffView.setUint16(20, 1);
  woffView.setUint16(22, 0);
  woffView.setUint32(24, 0);
  woffView.setUint32(28, 0);
  woffView.setUint32(32, 0);
  woffView.setUint32(36, 0);
  woffView.setUint32(40, 0);

  let dirOffset = 44;
  let dataOffset = woffHeaderSize + woffDirSize;

  for (const table of tables) {
    woffView.setUint32(dirOffset, table.tag);
    woffView.setUint32(dirOffset + 4, dataOffset);
    woffView.setUint32(dirOffset + 8, table.length);
    woffView.setUint32(dirOffset + 12, table.length);
    woffView.setUint32(dirOffset + 16, table.checkSum);

    woffBytes.set(sfntBytes.subarray(table.offset, table.offset + table.length), dataOffset);

    dirOffset += 20;
    dataOffset += table.paddedLength;
  }

  return woffBuffer;
}

export function downloadFont(
  font: opentype.Font,
  kerningPairs: { left: string, right: string, value: number }[],
  format: 'otf' | 'ttf' | 'woff'
) {
  let buffer = font.toArrayBuffer();

  // Inject kern table if we have kerning pairs
  const kernData = createKernTable(kerningPairs, font);
  if (kernData) {
    buffer = injectTable(buffer, 'kern', kernData);
  }

  // Wrap in WOFF if requested
  if (format === 'woff') {
    buffer = wrapInWoff(buffer);
  }

  const blob = new Blob([buffer], { type: format === 'woff' ? 'font/woff' : 'font/opentype' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const familyName = (font.names.fontFamily?.en ?? 'CustomFont').replace(/\s/g, '');
  const styleName = font.names.fontSubfamily?.en ?? 'Regular';
  link.download = `${familyName}-${styleName}.${format}`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
