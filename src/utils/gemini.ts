import { GoogleGenAI, Type } from '@google/genai';
import { LetterBox } from './fontGenerator';

export const detectLetters = async (base64Image: string, mimeType: string): Promise<LetterBox[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: mimeType,
        }
      },
      {
        text: `Analyze this image containing handwritten or printed characters.
Identify the bounding box for each character present.

CRITICAL INSTRUCTIONS FOR BOUNDING BOXES:
1. The bounding boxes MUST be extremely tight around the visible ink of each individual character.
2. DO NOT include any extra whitespace around the character.
3. EXTREMELY IMPORTANT: DO NOT include EVEN A SINGLE PIXEL of adjacent characters. If characters are close or touching, you must carefully isolate the target character. Including stray pixels from a taller adjacent character will completely ruin the font generation process.
4. For characters with ascenders (like 'h', 'l', 't', 'i', 'j') or descenders (like 'g', 'p', 'y', 'j', 'q'), ensure the box accurately captures the full vertical extent of the ink, including dots and descenders.
5. For characters like 'i' and 'j', the bounding box MUST include the dot.

Include uppercase and lowercase letters (A-Z, a-z), numerals (0-9), and common punctuation marks (!?. ,).
Return a JSON object with a 'letters' array.
Each element should have:
- 'char': the character (e.g., 'A', 'a', '0', '!', '.')
- 'box': [ymin, xmin, ymax, xmax] where values are normalized between 0 and 1000.
Ensure you find as many characters as possible, and that their bounding boxes are perfectly tight to avoid wonky alignment when converted to a font.`
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          letters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                char: { type: Type.STRING },
                box: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER }
                }
              },
              required: ['char', 'box']
            }
          }
        },
        required: ['letters']
      }
    }
  });

  if (!response.text) {
    throw new Error('No response from Gemini');
  }

  const result = JSON.parse(response.text);

  return result.letters.map((l: any, i: number) => ({
    id: `letter-${i}-${Date.now()}`,
    char: l.char,
    box: l.box
  }));
};

export type KerningPair = {
  left: string;
  right: string;
  value: number;
};

export const suggestKerning = async (base64Image: string, mimeType: string, detectedChars: string[]): Promise<KerningPair[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType: mimeType,
        }
      },
      {
        text: `Analyze the handwriting or font style in this image.
Based on the visual style and the characters present (${detectedChars.join(', ')}), suggest kerning pairs to improve visual harmony.
Focus on problematic pairs like 'AV', 'To', 'We', 'P.', 'L\'', 'WA', etc.
The kerning value should be in font units (typically between -150 and 150, where negative means closer together).
Return a JSON object with a 'kerning' array.`
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          kerning: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                left: { type: Type.STRING },
                right: { type: Type.STRING },
                value: { type: Type.NUMBER }
              },
              required: ['left', 'right', 'value']
            }
          }
        },
        required: ['kerning']
      }
    }
  });

  if (!response.text) {
    throw new Error('No response from Gemini');
  }

  const result = JSON.parse(response.text);
  return result.kerning || [];
};
