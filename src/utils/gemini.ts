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
        text: `Analyze this image containing handwritten or printed letters of the alphabet.
Identify the bounding box for each letter present.
Return a JSON object with a 'letters' array.
Each element should have:
- 'char': the character (e.g., 'A', 'a', 'B', 'b')
- 'box': [ymin, xmin, ymax, xmax] where values are normalized between 0 and 1000.
Ensure you find as many letters as possible, both uppercase and lowercase if present.`
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
