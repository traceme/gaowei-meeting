// 转录引擎接口定义和实现

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language: string;
}

export interface TranscriptionEngine {
  name: string;
  isAvailable(): Promise<boolean>;
  transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;
}

export interface TranscriptionOptions {
  language?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
}

// 本地faster-whisper引擎
export class LocalWhisperEngine implements TranscriptionEngine {
  name = 'local-whisper';
  private baseURL = 'http://localhost:8178'; // meeting-minutes Docker端口

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch (error) {
      console.log(`本地Whisper服务不可用: ${error}`);
      return false;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
