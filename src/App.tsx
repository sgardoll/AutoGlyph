import React, { useState, useRef, useEffect } from 'react';
import { Upload, Type, Download, Loader2, Settings, Trash2, Plus } from 'lucide-react';
import { LetterBox, FontMetrics, createFont, downloadFont } from './utils/fontGenerator';
import { detectLetters, suggestKerning, KerningPair } from './utils/gemini';
import { DEMO_ALPHABET_URL, DEMO_LETTERS } from './demoAlphabet';

import ImageCanvas from './components/ImageCanvas';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [letters, setLetters] = useState<LetterBox[]>([]);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDarkText, setIsDarkText] = useState(true);
  const [fontName, setFontName] = useState('My Custom Font');
  const [metrics, setMetrics] = useState<FontMetrics>({
    ascender: 800,
    descender: -200,
    xHeight: 500,
    capHeight: 700
  });
  const [kerningPairs, setKerningPairs] = useState<KerningPair[]>([]);
  const [isSuggestingKerning, setIsSuggestingKerning] = useState(false);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog');
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(10);

  const loadImageFromSource = (src: string, nextFile?: File | null) => {
    setImageFile(nextFile ?? null);
    setLetters([]);
    setSelectedLetterId(null);

    const img = new Image();
    img.onload = () => {
      setImageElement(img);
    };
    img.src = src;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setLetters([]);
    setSelectedLetterId(null);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageElement(img);
    };
    img.src = url;
  };

  const handleLoadDemo = async () => {
    const response = await fetch(DEMO_ALPHABET_URL);
    const blob = await response.blob();
    const demoFile = new File([blob], 'demo-alphabet.svg', { type: blob.type || 'image/svg+xml' });

    loadImageFromSource(DEMO_ALPHABET_URL, demoFile);
    setLetters(DEMO_LETTERS.map(letter => ({ ...letter })));
  };

  const handleDetect = async () => {
    if (!imageFile) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const detected = await detectLetters(base64, imageFile.type);
        setLetters(detected);
      } catch (error: any) {
        console.error('Error detecting letters:', error);
        if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
          alert('You have exceeded your Gemini API quota. Please check your plan and billing details, or try again later.');
        } else {
          alert('Failed to detect letters. Please try again.');
        }
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(imageFile);
  };

  const handleDownload = (format: 'otf' | 'ttf' | 'woff') => {
    if (!imageElement || letters.length === 0) return;
    try {
      const font = createFont(imageElement, letters, isDarkText, fontName, metrics, kerningPairs);
      downloadFont(font, kerningPairs, format);
    } catch (error) {
      console.error('Error generating font:', error);
      alert('Failed to generate font. Check console for details.');
    }
  };

  const handleSuggestKerning = async () => {
    if (!imageFile || letters.length === 0) return;
    setIsSuggestingKerning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const detectedChars = Array.from(new Set<string>(letters.map(l => l.char)));
        const suggestions = await suggestKerning(base64, imageFile.type, detectedChars);
        setKerningPairs(suggestions);
      } catch (error: any) {
        console.error('Error suggesting kerning:', error);
        if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
          alert('You have exceeded your Gemini API quota. Please check your plan and billing details, or try again later.');
        } else {
          alert('Failed to suggest kerning pairs. Please try again.');
        }
      } finally {
        setIsSuggestingKerning(false);
      }
    };
    reader.readAsDataURL(imageFile);
  };

  useEffect(() => {
    if (!imageElement || letters.length === 0 || !previewText) {
      setPreviewSvg('');
      return;
    }

    try {
      const font = createFont(imageElement, letters, isDarkText, fontName, metrics, kerningPairs);
      const fontSize = 72;
      const baselineY = metrics.ascender * (fontSize / 1000);
      const path = font.getPath(previewText, 0, baselineY, fontSize);
      const width = Math.max(1, font.getAdvanceWidth(previewText, fontSize));
      const height = Math.max(1, (metrics.ascender - metrics.descender) * (fontSize / 1000));

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${path.toSVG(2).replace('<path', '<path fill="currentColor"')}
      </svg>`;
      setPreviewSvg(svg);
    } catch (err) {
      console.error("Failed to generate preview", err);
    }
  }, [imageElement, letters, isDarkText, fontName, metrics, kerningPairs, previewText]);

  const updateSelectedChar = (char: string) => {
    if (!selectedLetterId) return;
    setLetters(prev => prev.map(l => l.id === selectedLetterId ? { ...l, char } : l));
  };

  const deleteSelectedBox = () => {
    if (!selectedLetterId) return;
    setLetters(prev => prev.filter(l => l.id !== selectedLetterId));
    setSelectedLetterId(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Type className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AutoGlyph</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/opentypejs/opentype.js" target="_blank" rel="noreferrer" className="text-sm text-neutral-500 hover:text-neutral-900">Powered by opentype.js</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Image & Canvas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">1. Upload Alphabet Image</h2>
              <div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Type className="w-4 h-4" />
                    Load Demo
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Choose Image
                  </label>
                </div>
              </div>
            </div>

            {imageElement ? (
              <div className="relative border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100">
                <ImageCanvas
                  imageElement={imageElement}
                  letters={letters}
                  setLetters={setLetters}
                  selectedLetterId={selectedLetterId}
                  setSelectedLetterId={setSelectedLetterId}
                  snapToGrid={snapToGrid}
                  gridSize={gridSize}
                />
                {letters.length === 0 && !isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <button
                      onClick={handleDetect}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                      <Type className="w-5 h-5" />
                      Detect Letters with AI
                    </button>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-sm font-medium text-neutral-600">Analyzing image and finding letters...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-neutral-300 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-neutral-50">
                <Upload className="w-10 h-10 text-neutral-400 mb-4" />
                <p className="text-neutral-600 font-medium mb-1">No image selected</p>
                <p className="text-neutral-500 text-sm">Upload an image containing handwritten or printed letters.</p>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Type className="w-4 h-4" />
                  Try the built-in demo
                </button>
              </div>
            )}

            {imageElement && letters.length > 0 && (
              <p className="text-xs text-neutral-500 mt-3 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Click on a bounding box to edit its character or delete it.
              </p>
            )}
          </div>

          {/* Real-time Preview */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-medium mb-4">Real-time Preview</h2>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Type to preview..."
            />
            <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50 overflow-x-auto min-h-[120px] flex items-center">
              {previewSvg ? (
                <div dangerouslySetInnerHTML={{ __html: previewSvg }} className="text-neutral-900" />
              ) : (
                <p className="text-sm text-neutral-400 text-center w-full">
                  {letters.length > 0 ? (previewText ? 'Generating preview...' : 'Type text to preview') : 'Detect letters to see preview'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Export */}
        <div className="space-y-6">

          {/* Edit Selected Letter */}
          {selectedLetterId && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 ring-1 ring-indigo-50">
              <h3 className="text-sm font-medium text-indigo-900 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Edit Selected Box
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  maxLength={1}
                  value={letters.find(l => l.id === selectedLetterId)?.char || ''}
                  onChange={(e) => updateSelectedChar(e.target.value)}
                  className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-center text-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Char"
                />
                <button
                  onClick={deleteSelectedBox}
                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors flex items-center justify-center"
                  title="Delete Box"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Canvas Settings */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-medium mb-4">Canvas Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Snap to Grid</p>
                  <p className="text-xs text-neutral-500">Align boxes precisely</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {snapToGrid && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Grid Size (px)</label>
                  <input
                    type="number"
                    min="1"
                    value={gridSize}
                    onChange={(e) => setGridSize(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-medium mb-4">2. Font Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Font Name</label>
                <input
                  type="text"
                  value={fontName}
                  onChange={(e) => setFontName(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Dark Text</p>
                  <p className="text-xs text-neutral-500">Image has dark ink on light background</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDarkText}
                    onChange={(e) => setIsDarkText(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Ascender</label>
                  <input
                    type="number"
                    value={metrics.ascender}
                    onChange={(e) => setMetrics({ ...metrics, ascender: parseInt(e.target.value) || 0 })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Descender</label>
                  <input
                    type="number"
                    value={metrics.descender}
                    onChange={(e) => setMetrics({ ...metrics, descender: parseInt(e.target.value) || 0 })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Cap Height</label>
                  <input
                    type="number"
                    value={metrics.capHeight}
                    onChange={(e) => setMetrics({ ...metrics, capHeight: parseInt(e.target.value) || 0 })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">x-Height</label>
                  <input
                    type="number"
                    value={metrics.xHeight}
                    onChange={(e) => setMetrics({ ...metrics, xHeight: parseInt(e.target.value) || 0 })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700">Detected Letters</span>
                  <span className="text-xs font-semibold bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full">
                    {letters.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                  {letters.length > 0 ? (
                    letters.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLetterId(l.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${
                          selectedLetterId === l.id
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-white text-neutral-700 border border-neutral-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {l.char}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-400 w-full text-center py-2">No letters detected yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">3. Kerning Pairs</h2>
              <button
                onClick={handleSuggestKerning}
                disabled={letters.length === 0 || isSuggestingKerning}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isSuggestingKerning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                Auto-Suggest
              </button>
            </div>

            {kerningPairs.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {kerningPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-center gap-1 bg-neutral-100 rounded-lg py-1">
                      <span className="font-medium text-lg">{pair.left}</span>
                      <span className="text-neutral-400">-</span>
                      <span className="font-medium text-lg">{pair.right}</span>
                    </div>
                    <input
                      type="number"
                      value={pair.value}
                      onChange={(e) => {
                        const newPairs = [...kerningPairs];
                        newPairs[idx].value = parseInt(e.target.value) || 0;
                        setKerningPairs(newPairs);
                      }}
                      className="w-20 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => setKerningPairs(kerningPairs.filter((_, i) => i !== idx))}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-4">
                No kerning pairs defined. Click Auto-Suggest to use AI to find problematic pairs.
              </p>
            )}

            <button
              onClick={() => setKerningPairs([...kerningPairs, { left: 'A', right: 'V', value: -50 }])}
              className="mt-4 w-full py-2 border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Manual Pair
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-medium mb-4">4. Export</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleDownload('otf')}
                disabled={letters.length === 0}
                className="w-full py-3 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download .otf
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDownload('ttf')}
                  disabled={letters.length === 0}
                  className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed text-neutral-800 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  .ttf
                </button>
                <button
                  onClick={() => handleDownload('woff')}
                  disabled={letters.length === 0}
                  className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed text-neutral-800 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  .woff
                </button>
              </div>
            </div>
            <p className="text-xs text-neutral-500 text-center mt-4">
              Generates font files with embedded kerning tables for maximum compatibility.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
