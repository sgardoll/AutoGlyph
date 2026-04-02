import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_ALPHABET_URL, DEMO_LETTERS } from './demoAlphabet';
import { FontSettingsPanel } from './components/FontSettingsPanel';
import { ProcessGuide } from './components/ProcessGuide';
import { SelectedGlyphPanel } from './components/SelectedGlyphPanel';
import { StatusPanel } from './components/StatusPanel';
import { TopBar } from './components/TopBar';
import { Notice } from './components/types';
import { WorkspacePanel } from './components/WorkspacePanel';
import { detectLetters } from './utils/gemini';
import { generateFont, LetterBox } from './utils/fontGenerator';
import { createManualLetterBox, pointInLetterBox } from './utils/glyphBox';

const DEFAULT_NOTICE: Notice = {
  tone: 'info',
  title: 'Start with a sheet',
  detail: 'Load the built-in demo or upload a photographed alphabet page to begin mapping glyphs.',
};

function formatGlyphCount(count: number) {
  if (count === 0) return 'No glyphs';
  if (count === 1) return '1 glyph';
  return `${count} glyphs`;
}

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [letters, setLetters] = useState<LetterBox[]>([]);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasDetectedGlyphs, setHasDetectedGlyphs] = useState(false);
  const [isDarkText, setIsDarkText] = useState(true);
  const [fontName, setFontName] = useState('Field Notes Sans');
  const [notice, setNotice] = useState<Notice>(DEFAULT_NOTICE);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);
  const [draftBox, setDraftBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const glyphInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedIndex = useMemo(
    () => letters.findIndex((letter) => letter.id === selectedLetterId),
    [letters, selectedLetterId],
  );

  const selectedLetter = useMemo(
    () => (selectedIndex >= 0 ? letters[selectedIndex] : null),
    [letters, selectedIndex],
  );

  const workflowLabel = useMemo(() => {
    if (!imageElement) return 'Awaiting source image';
    if (isProcessing) return 'Detecting glyph regions';
    if (letters.length === 0) return 'Ready for AI detection';
    if (selectedLetter) return `Editing glyph “${selectedLetter.char || '?'}”`;
    return 'Ready for export';
  }, [imageElement, isProcessing, letters.length, selectedLetter]);

  const selectIndex = (nextIndex: number) => {
    if (letters.length === 0) {
      setSelectedLetterId(null);
      return;
    }

    const normalizedIndex = ((nextIndex % letters.length) + letters.length) % letters.length;
    setSelectedLetterId(letters[normalizedIndex]?.id ?? null);
  };

  const loadImageFromSource = (src: string, nextFile?: File | null) => {
    setImageFile(nextFile ?? null);
    setLetters([]);
    setHasDetectedGlyphs(false);
    setSelectedLetterId(null);
    setDraftBox(null);
    setIsManualMode(false);
    setNotice({
      tone: 'info',
      title: 'Image loaded',
      detail: 'You can detect glyphs with Gemini or draw boxes manually. Export only needs labeled regions.',
    });

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
    e.target.value = '';
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleLoadDemo = async () => {
    const response = await fetch(DEMO_ALPHABET_URL);
    const blob = await response.blob();
    const demoFile = new File([blob], 'demo-alphabet.svg', { type: blob.type || 'image/svg+xml' });

    loadImageFromSource(DEMO_ALPHABET_URL, demoFile);
    const demoLetters = DEMO_LETTERS.map((letter) => ({ ...letter }));
    setLetters(demoLetters);
    setHasDetectedGlyphs(false);
    setSelectedLetterId(demoLetters[0]?.id ?? null);
    setNotice({
      tone: 'success',
      title: 'Demo loaded',
      detail: 'The sample sheet is ready. Inspect a glyph or export immediately to test the full loop.',
    });
  };

  const handleDetect = async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setNotice({
      tone: 'info',
      title: 'Detecting glyphs',
      detail: 'Gemini is scanning the page and proposing boxes. This can take a moment.',
    });

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
            return;
          }
          reject(new Error('Unable to read the uploaded image.'));
        };
        reader.onerror = () => {
          reject(reader.error ?? new Error('Unable to read the uploaded image.'));
        };
        reader.readAsDataURL(imageFile);
      });

      const detected = await detectLetters(base64, imageFile.type, imageElement ?? undefined);
      setLetters(detected);
      setHasDetectedGlyphs(true);
      setSelectedLetterId(detected[0]?.id ?? null);
      setNotice({
        tone: 'success',
        title: 'Detection complete',
      detail:
          detected.length > 0
            ? `Review ${formatGlyphCount(detected.length).toLowerCase()} and correct any mismatched labels before export.`
            : 'No glyphs were detected. Try a higher-contrast page or load the demo to test the workflow.',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to detect letters. Please try again.';
      setNotice({
        tone: 'error',
        title: 'Detection failed',
        detail: `${detail} You can still continue by drawing boxes manually.`,
      });
      console.error('Error detecting letters:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = () => {
    if (!imageElement || letters.length === 0) return;

    try {
      generateFont(imageElement, letters, isDarkText, fontName);
      setNotice({
        tone: 'success',
        title: 'Font exported',
        detail: `Downloaded ${fontName || 'your font'} as an OpenType file.`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Failed to generate font. Check console for details.';
      setNotice({
        tone: 'error',
        title: 'Export failed',
        detail,
      });
      console.error('Error generating font:', error);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageElement, 0, 0);

    letters.forEach((letter, index) => {
      const [ymin, xmin, ymax, xmax] = letter.box;
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const w = ((xmax - xmin) / 1000) * canvas.width;
      const h = ((ymax - ymin) / 1000) * canvas.height;

      const isSelected = selectedLetterId === letter.id;

      ctx.strokeStyle = isSelected ? '#d95d39' : '#315b8a';
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = isSelected ? '#d95d39' : '#315b8a';
      ctx.fillRect(x, y - 28, 28, 28);

      ctx.fillStyle = '#f7f2e8';
      ctx.font = '700 16px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter.char, x + 14, y - 14);

      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = 'rgba(217, 93, 57, 0.35)';
        ctx.lineWidth = 10;
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        ctx.restore();
      }

      if (isCanvasFocused) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = isSelected ? '#d95d39' : '#315b8a';
        ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(String(index + 1), x + w - 10, y + 12);
        ctx.restore();
      }
    });

    if (draftBox) {
      const x = Math.min(draftBox.startX, draftBox.currentX) * canvas.width;
      const y = Math.min(draftBox.startY, draftBox.currentY) * canvas.height;
      const w = Math.abs(draftBox.currentX - draftBox.startX) * canvas.width;
      const h = Math.abs(draftBox.currentY - draftBox.startY) * canvas.height;

      ctx.save();
      ctx.strokeStyle = '#2f7a4c';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(47, 122, 76, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

  }, [draftBox, imageElement, letters, selectedLetterId, isCanvasFocused]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !imageElement) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const normalizedX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const normalizedY = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return { normalizedX, normalizedY };
  };

  const commitDraftBox = (draft: { startX: number; startY: number; currentX: number; currentY: number }) => {
    const newLetter = createManualLetterBox(draft.startX, draft.startY, draft.currentX, draft.currentY);

    if (!newLetter) {
      setDraftBox(null);
      return;
    }

    setLetters((prev) => [...prev, newLetter]);
    setSelectedLetterId(newLetter.id);
    setHasDetectedGlyphs(false);
    setDraftBox(null);
    setIsManualMode(true);
    setNotice({
      tone: 'success',
      title: 'Manual glyph added',
      detail: 'Label the new region in the inspector, then continue drawing or export when ready.',
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageElement) return;
    if (draftBox) {
      commitDraftBox(draftBox);
      canvasStageRef.current?.focus();
      return;
    }

    if (isManualMode) {
      const point = getCanvasPoint(e.clientX, e.clientY);
      if (!point) return;

      setDraftBox({
        startX: point.normalizedX,
        startY: point.normalizedY,
        currentX: point.normalizedX,
        currentY: point.normalizedY,
      });
      canvasStageRef.current?.focus();
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const normalizedX = x / canvasRef.current.width;
    const normalizedY = y / canvasRef.current.height;
    const clicked = [...letters].reverse().find((letter) => pointInLetterBox(letter, normalizedX, normalizedY));

    setSelectedLetterId(clicked ? clicked.id : null);
    canvasStageRef.current?.focus();
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageElement || (!isManualMode && event.shiftKey === false)) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    setDraftBox({
      startX: point.normalizedX,
      startY: point.normalizedY,
      currentX: point.normalizedX,
      currentY: point.normalizedY,
    });
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftBox) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    setDraftBox((prev) =>
      prev
        ? { ...prev, currentX: point.normalizedX, currentY: point.normalizedY }
        : prev,
    );
  };

  const handleCanvasPointerUp = () => {
    if (draftBox) {
      commitDraftBox(draftBox);
    }
  };

  const handleBeginManualMode = () => {
    setIsManualMode(true);
    setNotice({
      tone: 'info',
      title: 'Manual boxing ready',
      detail: 'Drag directly on the canvas to create a glyph region. You can also keep using Shift-drag if you prefer.',
    });
    canvasStageRef.current?.focus();
  };

  const updateSelectedChar = (char: string) => {
    if (!selectedLetterId) return;

    setLetters((prev) => prev.map((letter) => (letter.id === selectedLetterId ? { ...letter, char } : letter)));
    setNotice({
      tone: 'info',
      title: 'Glyph relabeled',
      detail: char ? `The selected region is now mapped to “${char}”.` : 'Enter a single character to label this region.',
    });
  };

  const deleteSelectedBox = () => {
    if (!selectedLetterId) return;

    setLetters((prev) => prev.filter((letter) => letter.id !== selectedLetterId));
    if (selectedIndex > 0) {
      selectIndex(selectedIndex - 1);
    } else {
      setSelectedLetterId(null);
    }
    setNotice({
      tone: 'info',
      title: 'Glyph removed',
      detail: 'The selected region was removed from the export set.',
    });
    canvasStageRef.current?.focus();
  };

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (letters.length === 0) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        selectIndex(selectedIndex >= 0 ? selectedIndex + 1 : 0);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        selectIndex(selectedIndex >= 0 ? selectedIndex - 1 : letters.length - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectIndex(0);
        break;
      case 'End':
        event.preventDefault();
        selectIndex(letters.length - 1);
        break;
      case 'Backspace':
      case 'Delete':
        if (selectedLetterId) {
          event.preventDefault();
          deleteSelectedBox();
        }
        break;
      case 'Enter':
        if (selectedLetterId) {
          event.preventDefault();
          glyphInputRef.current?.focus();
          glyphInputRef.current?.select();
        }
        break;
      case 'Escape':
        if (draftBox) {
          event.preventDefault();
          setDraftBox(null);
          setNotice({
            tone: 'info',
            title: 'Manual box canceled',
            detail: 'Shift-drag again whenever you want to add another glyph region.',
          });
        }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const current = glyphInputRef.current;
    if (!current) return;
    if (selectedLetterId) {
      current.dataset.selectedId = selectedLetterId;
    }
  }, [selectedLetterId]);

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        id="image-upload"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      <TopBar workflowLabel={workflowLabel} />

      <main className="workspace-grid">
        <WorkspacePanel
          imageElement={imageElement}
          letters={letters}
          selectedLetter={selectedLetter}
          isProcessing={isProcessing}
          canDetect={Boolean(imageFile)}
          onLoadDemo={handleLoadDemo}
          onDetect={handleDetect}
          onBeginManualMode={handleBeginManualMode}
          onOpenFilePicker={handleOpenFilePicker}
          canvasRef={canvasRef}
          onCanvasClick={handleCanvasClick}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerUp={handleCanvasPointerUp}
          canvasStageRef={canvasStageRef}
          onCanvasKeyDown={handleCanvasKeyDown}
          isCanvasFocused={isCanvasFocused}
          isManualMode={isManualMode}
        />

        <aside className="inspector-column">
          <SelectedGlyphPanel
            selectedLetter={selectedLetter}
            selectedIndex={selectedIndex}
            totalLetters={letters.length}
            glyphInputRef={glyphInputRef}
            onCharChange={updateSelectedChar}
            onDelete={deleteSelectedBox}
          />

          <FontSettingsPanel
            fontName={fontName}
            isDarkText={isDarkText}
            letterCount={letters.length}
            hasDetectedGlyphs={hasDetectedGlyphs}
            onFontNameChange={setFontName}
            onDarkTextChange={setIsDarkText}
            onGenerate={handleGenerate}
            formatGlyphCount={formatGlyphCount}
          />

          <StatusPanel notice={notice} />
          <ProcessGuide />
        </aside>
      </main>

      <CanvasFocusSync targetRef={canvasStageRef} onFocusChange={setIsCanvasFocused} />
    </div>
  );
}

function CanvasFocusSync({
  targetRef,
  onFocusChange,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  onFocusChange: (focused: boolean) => void;
}) {
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const handleFocus = () => onFocusChange(true);
    const handleBlur = () => onFocusChange(false);

    target.addEventListener('focus', handleFocus);
    target.addEventListener('blur', handleBlur);

    return () => {
      target.removeEventListener('focus', handleFocus);
      target.removeEventListener('blur', handleBlur);
    };
  }, [onFocusChange, targetRef]);

  return null;
}
