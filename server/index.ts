import express from 'express';
import { config as loadEnv } from 'dotenv';
import { detectLettersWithGemini } from './gemini';

loadEnv({ path: '.env.local' });
loadEnv();

const app = express();
app.use(express.json({ limit: '20mb' }));

app.post('/api/detect-letters', async (req, res) => {
  const { imageDataUrl, mimeType } = req.body ?? {};

  if (typeof imageDataUrl !== 'string' || typeof mimeType !== 'string') {
    res.status(400).json({ error: 'imageDataUrl and mimeType are required.' });
    return;
  }

  try {
    const letters = await detectLettersWithGemini(imageDataUrl, mimeType);
    res.json({ letters });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Letter detection failed.';
    res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`AutoGlyph server listening on http://localhost:${port}`);
});
