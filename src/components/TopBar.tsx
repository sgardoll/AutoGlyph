import { AutoGlyphIcon } from './AutoGlyphIcon';

type TopBarProps = {
  workflowLabel: string;
};

export function TopBar({ workflowLabel }: TopBarProps) {
  return (
    <header className="topbar topbar-animated">
      <div className="topbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <AutoGlyphIcon className="h-8 w-8" />
        </div>
        <div>
          <p className="eyebrow">Alphabet to font, in one sitting</p>
          <h1>AutoGlyph</h1>
        </div>
      </div>

      <div className="topbar-status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        {workflowLabel}
      </div>
    </header>
  );
}
