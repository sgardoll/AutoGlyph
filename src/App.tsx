import React, { useState, useRef, useEffect } from 'react';
import { Upload, Type, Download, Loader2, Settings, Trash2 } from 'lucide-react';
import { LetterBox, generateFont } from './utils/fontGenerator';
import { detectLetters } from './utils/gemini';
import { DEMO_ALPHABET_URL, DEMO_LETTERS } from './demoAlphabet';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [letters, setLetters] = useState<LetterBox[]>([]);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDarkText, setIsDarkText] = useState(true);
  const [fontName, setFontName] = useState('My Custom Font');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const url = URL.createObjectURL(file);
    loadImageFromSource(url, file);
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
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const detected = await detectLetters(base64, imageFile.type);
        setLetters(detected);
        setIsProcessing(false);
      };
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('Error detecting letters:', error);
      alert('Failed to detect letters. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleGenerate = () => {
    if (!imageElement || letters.length === 0) return;
    try {
      generateFont(imageElement, letters, isDarkText, fontName);
    } catch (error) {
      console.error('Error generating font:', error);
      alert('Failed to generate font. Check console for details.');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

    ctx.drawImage(imageElement, 0, 0);

    letters.forEach(letter => {
      const [ymin, xmin, ymax, xmax] = letter.box;
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const w = ((xmax - xmin) / 1000) * canvas.width;
      const h = ((ymax - ymin) / 1000) * canvas.height;

      const isSelected = selectedLetterId === letter.id;
      
      ctx.strokeStyle = isSelected ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeRect(x, y, w, h);
      
      ctx.fillStyle = isSelected ? '#ef4444' : '#3b82f6';
      ctx.fillRect(x, y - 24, 24, 24);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter.char, x + 12, y - 12);
    });
  }, [imageElement, letters, selectedLetterId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageElement) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked box (reverse order to pick top-most if overlapping)
    const clicked = [...letters].reverse().find(letter => {
      const [ymin, xmin, ymax, xmax] = letter.box;
      const bx = (xmin / 1000) * canvasRef.current!.width;
      const by = (ymin / 1000) * canvasRef.current!.height;
      const bw = ((xmax - xmin) / 1000) * canvasRef.current!.width;
      const bh = ((ymax - ymin) / 1000) * canvasRef.current!.height;
      
      return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
    });

    setSelectedLetterId(clicked ? clicked.id : null);
  };

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
      <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Type className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">AutoGlyph</h1>
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
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="w-full h-auto cursor-crosshair block"
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
            <h2 className="text-lg font-medium mb-4">3. Export</h2>
            <button
              onClick={handleGenerate}
              disabled={letters.length === 0}
              className="w-full py-3 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download .otf
            </button>
            <p className="text-xs text-neutral-500 text-center mt-3">
              Generates an OpenType font file using the detected letters and calculated metrics.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
