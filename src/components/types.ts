import { AlertCircle } from 'lucide-react';

export type NoticeTone = 'idle' | 'info' | 'success' | 'error';

export type Notice = {
  tone: NoticeTone;
  title: string;
  detail: string;
};

export type NoticeIconType = typeof AlertCircle;
