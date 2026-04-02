import { Trash2 } from 'lucide-react';
import { LetterBox } from '../utils/fontGenerator';

type SelectedGlyphPanelProps = {
  selectedLetter: LetterBox | null;
  selectedIndex: number;
  totalLetters: number;
  glyphInputRef: React.RefObject<HTMLInputElement | null>;
  onCharChange: (char: string) => void;
  onDelete: () => void;
};

export function SelectedGlyphPanel({
  selectedLetter,
  selectedIndex,
  totalLetters,
  glyphInputRef,
  onCharChange,
  onDelete,
}: SelectedGlyphPanelProps) {
  return (
    <section className="surface inspector-surface panel-animated panel-delay-0">
      <div className="surface-header">
        <div>
          <p className="surface-kicker">Inspector</p>
          <h2>Selected glyph</h2>
        </div>
      </div>

      {selectedLetter ? (
        <div className="selection-card selection-card-active">
          <div className="selection-heading">
            <div>
              <p className="selection-label">Current mapping</p>
              <strong>{selectedLetter.char || 'Unlabeled'}</strong>
            </div>
            <div className="selection-meta">
              <span className="selection-order">
                {selectedIndex + 1} / {totalLetters}
              </span>
              <span className="selection-badge">Active</span>
            </div>
          </div>

          <label className="field-group">
            <span>Glyph character</span>
            <input
              ref={glyphInputRef}
              type="text"
              maxLength={1}
              value={selectedLetter.char}
              onChange={(e) => onCharChange(e.target.value)}
              className="ui-input ui-input-glyph"
              placeholder="A"
              aria-label="Selected glyph character"
            />
          </label>

          <p className="field-hint">
            Use arrow keys in the workspace to move between glyphs. Press Backspace to remove the selected region.
          </p>

          <button onClick={onDelete} className="ui-button ui-button-danger">
            <Trash2 className="h-4 w-4" />
            Remove this glyph
          </button>
        </div>
      ) : (
        <div className="selection-card">
          <p className="selection-empty-title">Nothing selected yet</p>
          <p className="selection-empty-copy">
            Click any box on the canvas, or focus the workspace and use the arrow keys once glyphs are available.
          </p>
        </div>
      )}
    </section>
  );
}
