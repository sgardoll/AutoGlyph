import { LetterBox } from './fontGenerator';

// TODO(showcase-security): Keep Gemini access behind the server endpoint before using this as a public showcase.
// The frontend should never ship a real production API key or call the Gemini SDK directly.

type DetectLettersResponse = {
  letters?: Array<{
    char: string;
    box: [number, number, number, number];
  }>;
  error?: string;
};

/**
 * Tighten Gemini's approximate bounding boxes using actual pixel data.
 * Gemini returns normalized 0-1000 coordinates that are often loose.
 * This function scans the actual image pixels within each box and
 * shrinks the box to the tightest ink boundary.
 */
function tightenBoxes(
  img: HTMLImageElement,
  boxes: Array<{ char: string; box: [number, number, number, number] }>,
  threshold = 240,
): Array<{ char: string; box: [number, number, number, number] }> {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = img.naturalWidth;
  tmpCanvas.height = img.naturalHeight;
  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) return boxes;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
  const data = imageData.data;
  const w = tmpCanvas.width;
  const h = tmpCanvas.height;

  return boxes.map(({ char, box }) => {
    const [yminNorm, xminNorm, ymaxNorm, xmaxNorm] = box;
    const x0 = Math.max(0, Math.floor((xminNorm / 1000) * w));
    const y0 = Math.max(0, Math.floor((yminNorm / 1000) * h));
    const x1 = Math.min(w - 1, Math.ceil((xmaxNorm / 1000) * w));
    const y1 = Math.min(h - 1, Math.ceil((ymaxNorm / 1000) * h));

    // Find tight bounds by scanning for non-background pixels
    let minX = x1, minY = y1, maxX = x0, maxY = y0;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        // Detect ink: not near white/transparent background
        const isLight = (r + g + b) / 3 > threshold && a > 128;
        if (!isLight) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If no ink found, keep original box
    if (maxX < minX || maxY < minY) return { char, box };

    return {
      char,
      box: [
        Math.round((minY / h) * 1000),
        Math.round((minX / w) * 1000),
        Math.round((maxY / h) * 1000),
        Math.round((maxX / w) * 1000),
      ] as [number, number, number, number],
    };
  });
}

export const detectLetters = async (
  base64Image: string,
  mimeType: string,
  imageElement?: HTMLImageElement,
): Promise<LetterBox[]> => {
  const response = await fetch('/api/detect-letters.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageDataUrl: base64Image,
      mimeType,
    }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Gemini detection endpoint returned a non-JSON response. Check /api/detect-letters.php on the server.');
  }

  const result = (await response.json()) as DetectLettersResponse;

  if (!response.ok) {
    throw new Error(result.error || 'Failed to detect letters.');
  }

  let letters = result.letters ?? [];

  // Tighten boxes using actual pixel data if we have the image element
  if (imageElement && letters.length > 0) {
    letters = tightenBoxes(imageElement, letters);
  }

  return letters.map((letter, index) => ({
    id: `letter-${index}-${Date.now()}`,
    char: letter.char,
    box: letter.box,
  }));
};
