import { AlertCircle, CheckCircle2, ScanText } from 'lucide-react';
import { Notice, NoticeIconType, NoticeTone } from './types';

const toneClassMap: Record<NoticeTone, string> = {
  idle: 'status-panel status-panel-idle',
  info: 'status-panel status-panel-info',
  success: 'status-panel status-panel-success',
  error: 'status-panel status-panel-error',
};

const toneIconMap: Record<NoticeTone, NoticeIconType> = {
  idle: ScanText,
  info: ScanText,
  success: CheckCircle2,
  error: AlertCircle,
};

type StatusPanelProps = {
  notice: Notice;
};

export function StatusPanel({ notice }: StatusPanelProps) {
  const NoticeIcon = toneIconMap[notice.tone];

  return (
    <section className={toneClassMap[notice.tone]} aria-live="polite">
      <div className="status-panel-icon" aria-hidden="true">
        <NoticeIcon className="h-4 w-4" />
      </div>
      <div>
        <p className="status-panel-title">{notice.title}</p>
        <p className="status-panel-detail">{notice.detail}</p>
      </div>
    </section>
  );
}
