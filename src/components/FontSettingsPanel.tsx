import { Download } from 'lucide-react';

type FontSettingsPanelProps = {
  fontName: string;
  isDarkText: boolean;
  letterCount: number;
  hasDetectedGlyphs: boolean;
  onFontNameChange: (value: string) => void;
  onDarkTextChange: (value: boolean) => void;
  onGenerate: () => void;
  formatGlyphCount: (count: number) => string;
};

export function FontSettingsPanel({
  fontName,
  isDarkText,
  letterCount,
  hasDetectedGlyphs,
  onFontNameChange,
  onDarkTextChange,
  onGenerate,
  formatGlyphCount,
}: FontSettingsPanelProps) {
  return (
    <section className="surface inspector-surface panel-animated panel-delay-1">
      <div className="surface-header">
        <div>
          <p className="surface-kicker">Output</p>
          <h2>Font settings</h2>
        </div>
      </div>

      <div className="stack-lg">
        <label className="field-group">
          <span>Font name</span>
          <input type="text" value={fontName} onChange={(e) => onFontNameChange(e.target.value)} className="ui-input" />
        </label>

        <div className="toggle-card">
          <div>
            <p>Dark ink on light background</p>
            <span>Turn this off if the uploaded page uses light marks on a dark field.</span>
          </div>
          <label className="switch" aria-label="Dark ink on light background">
            <input type="checkbox" checked={isDarkText} onChange={(e) => onDarkTextChange(e.target.checked)} />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>

        <div className="status-list">
          <div className="status-row">
            <span>Export set</span>
            <strong>{formatGlyphCount(letterCount)}</strong>
          </div>
          <div className="status-row">
            <span>Gemini assist</span>
            <strong>{hasDetectedGlyphs ? 'Used for current set' : 'Optional'}</strong>
          </div>
        </div>

        <button onClick={onGenerate} disabled={letterCount === 0} className="ui-button ui-button-primary ui-button-block export-button">
          <Download className="h-4 w-4" />
          Export OpenType font
        </button>

        <p className="field-hint">
          AutoGlyph traces each selected region into vector glyphs and downloads a ready-to-test <code>.otf</code> file.
        </p>
      </div>
    </section>
  );
}
