// 基础类型
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// 音频相关类型
export interface AudioFile {
  id: string;
  filename: string;
  url?: string;
  path?: string;
  size: number;
  duration?: number;
  format: FileFormat;
  uploaded_at?: string;
  uploadedAt?: string;
}

export interface AudioSegment {
  start: number;
  end: number;
  text: string;
  t0?: number;
  t1?: number;
  confidence?: number;
}

// 会议相关类型
export interface Meeting {
  id: string;
  title: string;
  description?: string;
  status?: string;
  audio_path?: string;
  transcription?: string;
  summary?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  transcripts?: Transcript[];
}

// 转录相关类型
export interface Transcript {
  id: string;
  text?: string;
  meeting_id?: string;
  transcript?: string;
  timestamp: string;
  audio_url?: string;
  segments?: AudioSegment[];
  summary?: string;
  action_items?: string;
  key_points?: string;
}

export interface TranscriptChunk {
  meeting_id: string;
  meeting_name?: string;
  transcript_text: string;
  model: string;
  model_name: string;
  chunk_size?: number;
  overlap?: number;
  created_at: string;
}

export interface TranscriptionResult {
  text: string;
  segments?: AudioSegment[];
  language?: string;
  confidence?: number;
  duration?: number;
  model?: string;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

// 转录任务类型
export interface TranscriptionTask {
  id: string;
  meeting_id: string;
  filename: string;
  status: TaskStatus;
  progress: number;
  result?: TranscriptionResult;
  summary?: {
    text: string;
    model: string;
    created_at: string;
  };
  error?: string;
  created_at: string;
  updated_at: string;
  // 音频文件相关字段
  audio_path?: string;
  actual_filename?: string;
  duration?: string; // 音频时长（格式化后的字符串，如 "3:45"）
  duration_seconds?: number; // 音频时长（秒数）
  elapsedTime?: number; // 已用时间（秒数）
  estimatedTime?: number; // 预计总时间（秒数）
  engine?: string; // 转录引擎
}

// 处理任务类型
export interface ProcessTask {
  id: string;
  meeting_id: string;
  status: TaskStatus;
  progress: number;
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

// 转录引擎选项
export interface TranscriptionOptions {
  engine: TranscriptionEngineType;
  model?: string;
  language?: string;
  format?: string;
  quality?: 'low' | 'medium' | 'high';
}

// Whisper引擎类型定义
export type WhisperEngineType = 'faster-whisper' | 'whisper-cpp' | 'openai';

// Whisper引擎配置
export interface WhisperEngineConfig {
  type: WhisperEngineType;
  port?: number;
  modelPath?: string;
  serverUrl?: string;
  enabled: boolean;
  description: string;
  features: {
    realTimeProgress: boolean;
    multiLanguage: boolean;
    gpu: boolean;
    performance: 'low' | 'medium' | 'high';
    memoryUsage: 'low' | 'medium' | 'high';
  };
}

// 转录引擎状态
export interface WhisperEngineStatus {
  type: WhisperEngineType;
  status: 'starting' | 'running' | 'stopped' | 'error';
  port?: number;
  pid?: number;
  lastCheck: string;
  error?: string;
  version?: string;
  capabilities?: string[];
}

// 引擎选择请求
export interface EngineSelectionRequest {
  engine: WhisperEngineType;
  file: File | Buffer;
  options?: {
    language?: string;
    model?: string;
    temperature?: number;
  };
}

// 摘要处理类型
export interface SummaryProcess {
  meeting_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  error?: string;
  result?: string;
  start_time?: string;
  end_time?: string;
  chunk_count?: number;
  processing_time?: number;
  metadata?: string;
}

// AI摘要相关类型
export interface SummaryRequest {
  text?: string;
  transcript?: string;
  meetingId?: string;
  meeting_id?: string;
  model?: string;
  options?: {
    includeKeyPoints?: boolean;
    includeActionItems?: boolean;
    language?: string;
  };
}

export interface SummaryResponse {
  text?: string;
  summary?: string;
  model?: string;
  created_at?: string;
  keyPoints?: string[];
  actionItems?: string[];
  participants?: string[];
  topics?: string[];
  metadata?: {
    processingTime: number;
    chunkCount: number;
    model: string;
  };
}

// 模型配置类型
export interface ModelConfig {
  id: string;
  provider: string;
  model: string;
  whisperModel?: string;
  whisper_model?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  ollamaApiKey?: string;
  api_key?: string;
  base_url?: string;
}

// API配置类型
export interface ApiConfig {
  provider: string;
  model?: string;
  whisper_model?: string;
  api_key?: string;
  apiKey?: string;
  base_url?: string;
  baseUrl?: string;
}

export interface ApiKeyConfig {
  groq?: string;
  openai?: string;
  anthropic?: string;
  ollama?: string;
}

// 音频播放器相关类型
export interface AudioPlayerProps {
  audioUrl: string;
  segments: AudioSegment[];
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentClick?: (segment: AudioSegment) => void;
  className?: string;
}

// 用户设置类型
export interface UserSettings {
  preferred_ai_model?: string;
  preferred_whisper_model?: string;
  auto_summary?: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications?: {
    email: boolean;
    push: boolean;
    transcriptionComplete: boolean;
    summaryReady: boolean;
  };
  transcription?: {
    defaultEngine: string;
    autoTranscribe: boolean;
    language: string;
  };
}

// API响应类型
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError | string;
  message?: string;
  timestamp: string;
}

export interface ApiResponse<T = any> extends APIResponse<T> {}

export interface ApiError extends APIError {}

// 分页类型
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items?: T[];
  data?: T[];
  total: number;
  page: number;
  limit: number;
  has_next?: boolean;
  has_prev?: boolean;
  totalPages?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  success?: boolean;
  timestamp?: string;
}

// 文件上传类型
export interface FileUploadResponse {
  id: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
  uploaded_at: string;
}

export interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// 转录统计类型
export interface TranscriptionStats {
  total_files: number;
  total_duration: number;
  total_words: number;
  languages: Record<string, number>;
  models_used: Record<string, number>;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

export interface TranscriptionProgress extends WebSocketMessage {
  type: 'transcription_progress';
  payload: {
    meetingId: string;
    progress: number;
    status: string;
    currentSegment?: string;
  };
}

// 常量和类型别名
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mp3',
  'audio/wav',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
] as const;

export const AI_PROVIDERS = [
  'ollama',
  'openai',
  'claude',
  'anthropic',
  'google',
  'mistral',
  'azure',
  'openrouter',
  'xai',
  'groq',
] as const;

export const TRANSCRIPTION_ENGINES = [
  'whisper-cpp',
  'whisper-local',
  'whisper-openai',
  'openai-whisper',
  'azure-speech',
  'google-speech',
  'groq-whisper',
  'local',
] as const;

export type SupportedAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number];
export type AIProvider = (typeof AI_PROVIDERS)[number];
export type TranscriptionEngineType = (typeof TRANSCRIPTION_ENGINES)[number];

export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled';
export type FileFormat = 'mp3' | 'wav' | 'm4a' | 'flac' | 'ogg' | 'webm';
