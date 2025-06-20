// 共享类型定义
export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

export interface AudioFile {
  id: string;
  filename: string;
  size: number;
  duration?: number;
  format: string;
  uploadedAt: Date;
}

export interface MeetingSummary {
  id: string;
  audioFileId: string;
  summary: string;
  actionItems: string[];
  keyPoints: string[];
  createdAt: Date;
}

export {};
