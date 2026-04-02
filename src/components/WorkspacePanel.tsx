import { Loader2, ScanText, Upload, Wand2 } from 'lucide-react';
import { LetterBox } from '../utils/fontGenerator';

type WorkspacePanelProps = {
  imageElement: HTMLImageElement | null;
  letters: LetterBox[];
  selectedLetter: LetterBox | null;
  isProcessing: boolean;
  canDetect: boolean;
  onLoadDemo: () => void;
  onOpenFilePicker: () => void;
  onDetect: () => void;
  onBeginManualMode: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onCanvasClick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerUp: () => void;
  canvasStageRef: React.RefObject<HTMLDivElement | null>;
  onCanvasKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  isCanvasFocused: boolean;
  isManualMode: boolean;
};

export function WorkspacePanel({
  imageElement,
  letters,
  selectedLetter,
  isProcessing,
  canDetect,
  onLoadDemo,
  onOpenFilePicker,
  onDetect,
  onBeginManualMode,
  canvasRef,
  onCanvasClick,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  canvasStageRef,
  onCanvasKeyDown,
  isCanvasFocused,
  isManualMode,
}: WorkspacePanelProps) {
  return (
    <section className="canvas-column panel-animated panel-delay-0">
      <div className="surface hero-surface hero-surface-animated">
        <div className="surface-header">
          <div>
            <p className="surface-kicker">Workspace</p>
            <h2>Source sheet</h2>
            <p className="surface-copy">
              Upload an alphabet sheet, then either detect glyphs with Gemini or draw boxes manually. Export only needs labeled regions.
            </p>
          </div>

          {imageElement ? (
            <div className="toolbar-cluster">
              {!isManualMode && canDetect && (
                <button type="button" onClick={onDetect} className="ui-button ui-button-secondary toolbar-button">
                  <ScanText className="h-4 w-4" />
                  Detect with Gemini
                </button>
              )}

              {!isManualMode && (
                <button type="button" onClick={onBeginManualMode} className="ui-button ui-button-ghost toolbar-button">
                  <Wand2 className="h-4 w-4" />
                  Draw boxes manually
                </button>
              )}
            </div>
          ) : (
            <div className="toolbar-cluster toolbar-cluster-quiet">
              <p className="toolbar-caption">Start with a real sheet or the bundled demo.</p>
            </div>
          )}
        </div>

        {imageElement ? (
          <div
            ref={canvasStageRef}
            className={`canvas-stage ${isCanvasFocused ? 'canvas-stage-focused' : ''}`}
            tabIndex={0}
            onKeyDown={onCanvasKeyDown}
            aria-label="Glyph selection workspace"
            aria-describedby="workspace-keyboard-help"
          >
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              className="canvas-element"
              aria-label="Detected glyph regions on the uploaded source image"
            />

            <div id="workspace-keyboard-help" className="workspace-keyboard-hint">
              Drag to draw a box. Arrow keys move selection. Home/End jump. Backspace removes. Enter focuses the label field.
            </div>

            {letters.length === 0 && !isProcessing && !isManualMode && (
              <div className="canvas-overlay">
                <div className="overlay-card overlay-card-animated">
                  <p className="overlay-eyebrow">Optional assist</p>
                  <h3>Add your first glyph region</h3>
                  <p>
                    You can draw boxes manually right now. Gemini detection is optional and only helps you move faster.
                  </p>
                  <div className="overlay-actions">
                    <button onClick={onBeginManualMode} className="ui-button ui-button-primary detect-button">
                      <Wand2 className="h-4 w-4" />
                      Start manual boxing
                    </button>
                    {canDetect && (
                      <button onClick={onDetect} className="ui-button ui-button-secondary detect-button">
                        <ScanText className="h-4 w-4" />
                        Detect with Gemini
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="canvas-overlay canvas-overlay-processing" aria-live="polite">
                <div className="overlay-card overlay-card-processing overlay-card-animated">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <div>
                    <h3>Scanning your sheet</h3>
                    <p>Looking for distinct glyph regions and preparing editable labels.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-stage empty-stage-animated">
            <div className="empty-illustration" aria-hidden="true">
              <Upload className="h-8 w-8" />
            </div>
            <p className="empty-kicker">No source image loaded</p>
            <h3>Bring in a photographed alphabet sheet</h3>
            <p>
              Use a high-contrast page with generous spacing between characters. If you just want to feel the flow, load the demo.
            </p>
            <div className="toolbar-cluster toolbar-cluster-center">
              <button type="button" onClick={onOpenFilePicker} className="ui-button ui-button-primary toolbar-button">
                <Upload className="h-4 w-4" />
                Upload image
              </button>
              <button type="button" onClick={onLoadDemo} className="ui-button ui-button-ghost toolbar-button">
                <Wand2 className="h-4 w-4" />
                Load demo
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
