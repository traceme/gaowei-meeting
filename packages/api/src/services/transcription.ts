// 转录引擎服务 - 使用新的whisper-engine包
import { AppConfig } from '../config/index.js';
import {
  createWhisperEngine,
  WhisperService,
  LocalWhisperEngine,
  OpenAIWhisperEngine,
} from '@gaowei/whisper-engine';
import type { TranscriptionResult } from '@gaowei/shared-types';

export interface TranscriptionOptions {
  language?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  engineType?: 'local' | 'openai';
}

// 转录引擎包装器（兼容旧接口）
export interface TranscriptionEngine {
  name: string;
  isAvailable(): Promise<boolean>;
  transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;
}

// 本地Whisper引擎适配器
export class LocalWhisperEngineAdapter implements TranscriptionEngine {
  name = 'local-whisper';
  private whisperService: WhisperService;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.whisperService = createWhisperEngine('local', {
      serverUrl: config.whisper.serverUrl,
      serverPort: config.whisper.serverPort || 8178,
      modelPath: config.whisper.modelSize || 'small',
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // 只检查健康状态，不尝试启动服务
      return await this.whisperService.isHealthy();
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
    try {
      // 确保服务已启动
      await this.whisperService.start();

      const result = await this.whisperService.transcribe(audioBuffer, {
        filename,
        language: options?.language,
        model: options?.modelSize,
      });

      return result;
    } catch (error) {
      throw new Error(
        `本地Whisper转录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stop(): Promise<void> {
    await this.whisperService.stop();
  }
}

// OpenAI Whisper引擎适配器
export class OpenAIWhisperEngineAdapter implements TranscriptionEngine {
  name = 'openai-whisper';
  private whisperService: WhisperService;

  constructor(apiKey: string) {
    this.whisperService = createWhisperEngine('openai-whisper', {
      apiKey,
    });
  }

  async isAvailable(): Promise<boolean> {
    return await this.whisperService.isHealthy();
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    try {
      const result = await this.whisperService.transcribe(audioBuffer, {
        filename,
        language: options?.language,
        model: 'whisper-1',
      });

      return result;
    } catch (error) {
      throw new Error(
        `OpenAI Whisper转录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// 转录引擎管理器
export class TranscriptionRouter {
  private engines: (TranscriptionEngine & { stop?: () => Promise<void> })[] =
    [];
  private localEngine?: LocalWhisperEngineAdapter;

  constructor(config: AppConfig) {
    // 初始化本地Whisper引擎
    this.localEngine = new LocalWhisperEngineAdapter(config);
    this.engines.push(this.localEngine);

    // 初始化OpenAI Whisper引擎（如果有API密钥）
    if (config.ai.providers.openai?.apiKey) {
      this.engines.push(
        new OpenAIWhisperEngineAdapter(config.ai.providers.openai.apiKey)
      );
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    let lastError: Error | null = null;

    // 如果指定了引擎类型，只使用该引擎
    if (options?.engineType) {
      const targetEngine = this.engines.find(engine => {
        if (options.engineType === 'local' && engine.name === 'local-whisper')
          return true;
        if (options.engineType === 'openai' && engine.name === 'openai-whisper')
          return true;
        return false;
      });

      if (targetEngine) {
        if (await targetEngine.isAvailable()) {
          console.log(`🎙️ 使用指定的 ${targetEngine.name} 引擎进行转录...`);
          return await targetEngine.transcribe(audioBuffer, filename, options);
        } else {
          throw new Error(`指定的 ${options.engineType} 引擎不可用`);
        }
      } else {
        throw new Error(`未找到指定的转录引擎: ${options.engineType}`);
      }
    }

    // 自动选择可用引擎
    for (const engine of this.engines) {
      try {
        if (await engine.isAvailable()) {
          console.log(`🎙️ 使用 ${engine.name} 引擎进行转录...`);
          const result = await engine.transcribe(
            audioBuffer,
            filename,
            options
          );
          console.log(
            `✅ ${engine.name} 转录成功，文本长度: ${result.text?.length || 0} 字符`
          );
          return result;
        } else {
          console.log(`⚠️ ${engine.name} 引擎不可用，跳过`);
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(`${engine.name} 转录失败`);
        console.warn(`❌ ${engine.name} 转录失败:`, lastError.message);
        continue;
      }
    }

    // 所有引擎都失败了
    throw new Error(
      `所有转录引擎都不可用: ${lastError?.message || '未知错误'}`
    );
  }

  async getEngineStatus(): Promise<
    Array<{ name: string; available: boolean; type: string }>
  > {
    const status = [];
    for (const engine of this.engines) {
      try {
        const available = await engine.isAvailable();
        const type = engine.name.includes('local') ? 'local' : 'api';
        status.push({ name: engine.name, available, type });
      } catch (error) {
        const type = engine.name.includes('local') ? 'local' : 'api';
        status.push({ name: engine.name, available: false, type });
      }
    }
    return status;
  }

  async stop(): Promise<void> {
    // 停止本地Whisper服务
    if (this.localEngine) {
      await this.localEngine.stop();
    }
  }
}
