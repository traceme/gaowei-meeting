import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import type {
  TranscriptionResult,
  TranscriptionEngineType,
  WhisperEngineType,
  WhisperEngineConfig,
  WhisperEngineStatus,
} from '@gaowei/shared-types';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Whisper服务接口
export interface WhisperService {
  transcribe(
    audioBuffer: Buffer,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult>;
  isHealthy(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// 转录选项（重命名避免冲突）
export interface WhisperTranscriptionOptions {
  language?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  filename?: string;
}

// 异步任务状态
export interface WhisperTaskStatus {
  task_id: string;
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  progress_text?: string;
  result?: TranscriptionResult;
  error?: string;
}

// 本地Whisper引擎实现
class LocalWhisperEngine implements WhisperService {
  private readonly serverUrl: string;
  private readonly serverPort: number;
  private readonly modelPath: string;
  private pythonProcess: ChildProcess | null = null;
  private isRunning = false;
  private startPromise: Promise<void> | null = null;

  constructor(
    options: {
      serverUrl?: string;
      serverPort?: number;
      modelPath?: string;
    } = {}
  ) {
    this.serverPort = options.serverPort || 8178;
    this.serverUrl = options.serverUrl || `http://localhost:${this.serverPort}`;
    this.modelPath = options.modelPath || 'small';
  }

  async start(): Promise<void> {
    // 检查服务是否已经在运行（重构前的服务）
    const isHealthy = await this.isHealthy();
    if (isHealthy) {
      console.log('Found existing Whisper service running, using it directly');
      this.isRunning = true;
      return;
    }

    if (this.isRunning) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this._startPythonService();
    return this.startPromise;
  }

  private async _startPythonService(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 优先使用新的Python服务（重构后的版本）
      const newPythonScript = path.join(
        __dirname,
        '..',
        'src',
        'python',
        'app.py'
      );

      console.log(`Starting Whisper Python service: ${newPythonScript}`);
      console.log(`Port: ${this.serverPort}, Model: ${this.modelPath}`);

      // 检查新Python脚本是否存在
      if (fs.existsSync(newPythonScript)) {
        console.log(`Using NEW enhanced Python service: ${newPythonScript}`);
        this._startWithScript(newPythonScript, resolve, reject);
      } else {
        // 降级到旧版本（兼容性）
        const fallbackScript = path.join(
          __dirname,
          'whisper-cpp-server',
          'app.py'
        );
        
        if (!fs.existsSync(fallbackScript)) {
          reject(new Error(`Python script not found: ${newPythonScript} or ${fallbackScript}`));
          return;
        }
        
        console.log(`Using fallback whisper-cpp-server: ${fallbackScript}`);
        this._startWithScript(fallbackScript, resolve, reject);
      }
    });
  }

  private _startWithScript(
    pythonScript: string,
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
    this.pythonProcess = spawn(
      'python',
      [
        pythonScript,
        '--port',
        this.serverPort.toString(),
        '--model-path',
        this.modelPath,
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      }
    );

    let isResolved = false;

    this.pythonProcess.stdout?.on('data', data => {
      const output = data.toString();
      console.log(`Whisper service: ${output.trim()}`);

      // 检查服务是否启动成功
      if (output.includes('Starting Whisper service on') && !isResolved) {
        isResolved = true;
        this.isRunning = true;
        // 等待一下让服务完全启动
        setTimeout(() => resolve(), 2000);
      }
    });

    this.pythonProcess.stderr?.on('data', data => {
      const error = data.toString();
      console.error(`Whisper service error: ${error.trim()}`);
    });

    this.pythonProcess.on('error', error => {
      console.error('Failed to start Whisper service:', error);
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    });

    this.pythonProcess.on('exit', code => {
      console.log(`Whisper service exited with code ${code}`);
      this.isRunning = false;
      this.pythonProcess = null;
    });

    // 超时处理
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Whisper service start timeout'));
      }
    }, 30000); // 30秒超时
  }

  async stop(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');

      // 等待进程结束
      await new Promise<void>(resolve => {
        if (this.pythonProcess) {
          this.pythonProcess.on('exit', () => resolve());
          // 5秒后强制结束
          setTimeout(() => {
            if (this.pythonProcess) {
              this.pythonProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
    }

    this.isRunning = false;
    this.pythonProcess = null;
    this.startPromise = null;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200 && response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    // 确保服务正在运行
    if (!this.isRunning) {
      await this.start();
    }

    // 再次检查健康状态
    const healthy = await this.isHealthy();
    if (!healthy) {
      throw new Error('Whisper服务不可用');
    }

    const startTime = Date.now();

    // 计算动态超时时间
    const getTranscriptionTimeout = (audioBuffer: Buffer): number => {
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 假设每2MB约1分钟音频
      const transcriptionMinutes = Math.max(estimatedMinutes * 1.5, 10); // 转录时间是音频时长的1.5倍，至少10分钟
      return Math.min(transcriptionMinutes * 60 * 1000, 360 * 60 * 1000); // 毫秒，最大360分钟
    };

    const timeoutMs = getTranscriptionTimeout(audioBuffer);
    console.log(`📊 Faster-Whisper 预计转录时间: ${Math.round(timeoutMs/60000)} 分钟，文件大小: ${Math.round(audioBuffer.length/(1024*1024))}MB`);

    try {
      // 准备FormData
      const formData = new FormData();
      
      // 保持原始文件名和扩展名，避免强制转换为wav
      const originalFilename = options?.filename || `audio_${Date.now()}.aiff`;
      const fileExtension = originalFilename.split('.').pop() || 'aiff';
      
      formData.append('file', audioBuffer, {
        filename: originalFilename,
        contentType: `audio/${fileExtension}`,
      });

      if (options?.language) {
        formData.append('language', options.language);
      }

      // 发送转录请求
      const response = await axios.post(
        `${this.serverUrl}/inference`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: timeoutMs,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      const data = response.data;

      // 处理异步任务
      if (data.task_id) {
        return await this.waitForTaskCompletion(data.task_id);
      }

      // 处理同步结果
      return {
        text: data.text || '',
        language: data.language || 'unknown',
        confidence: 0.95, // Python服务没有返回confidence，使用默认值
        duration: data.duration || (Date.now() - startTime) / 1000,
        segments: data.segments || [],
        model: this.modelPath,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(`转录失败: ${message}`);
      }
      throw new Error(
        `转录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async waitForTaskCompletion(
    taskId: string
  ): Promise<TranscriptionResult> {
    // 动态超时时间，从5分钟增加到360分钟，用于处理长音频
    const maxWaitTime = 360 * 60 * 1000; // 360分钟
    const pollInterval = 2000; // 2秒
    const startTime = Date.now();

    console.log(`⏱️ 开始等待任务完成，最大等待时间: ${maxWaitTime/60000} 分钟`);

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${this.serverUrl}/status/${taskId}`);
        const status: WhisperTaskStatus = response.data;

        if (status.status === 'completed' && status.result) {
          return {
            text: status.result.text || '',
            language: status.result.language || 'unknown',
            confidence: 0.95,
            duration: status.result.duration || 0,
            segments: status.result.segments || [],
            model: this.modelPath,
          };
        }

        if (status.status === 'error') {
          throw new Error(`转录任务失败: ${status.error}`);
        }

        // 继续等待
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          throw new Error('转录任务未找到');
        }
        // 其他错误继续重试
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error('转录任务超时');
  }
}

// C++ Whisper引擎实现
class WhisperCppEngine implements WhisperService {
  private readonly serverUrl: string;
  private readonly serverPort: number;
  private readonly modelPath: string;
  private cppProcess: ChildProcess | null = null;
  private isRunning = false;
  private startPromise: Promise<void> | null = null;

  constructor(
    options: {
      serverUrl?: string;
      serverPort?: number;
      modelPath?: string;
    } = {}
  ) {
    this.serverPort = options.serverPort || 8081; // 不同端口避免冲突
    this.serverUrl = options.serverUrl || `http://localhost:${this.serverPort}`;
    this.modelPath = options.modelPath || 'models/ggml-base.en.bin';
  }

  async start(): Promise<void> {
    // 检查服务是否已经在运行
    const isHealthy = await this.isHealthy();
    if (isHealthy) {
      console.log('Found existing Whisper.cpp service running, using it directly');
      this.isRunning = true;
      return;
    }

    if (this.isRunning) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this._startCppService();
    return this.startPromise;
  }

  private async _startCppService(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查编译的服务器是否存在
      const serverPath = path.join(__dirname, 'whisper-cpp-server', 'build', 'examples', 'server', 'whisper-server');
      
      if (!fs.existsSync(serverPath)) {
        reject(new Error(`Whisper.cpp server not found at: ${serverPath}. Please compile first.`));
        return;
      }

      console.log(`Starting Whisper.cpp service: ${serverPath}`);
      console.log(`Port: ${this.serverPort}, Model: ${this.modelPath}`);

      this.cppProcess = spawn(
        serverPath,
        [
          '--port',
          this.serverPort.toString(),
          '--model',
          this.modelPath,
          '--host',
          '127.0.0.1',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        }
      );

      let isResolved = false;

      this.cppProcess.stdout?.on('data', data => {
        const output = data.toString();
        console.log(`Whisper.cpp service: ${output.trim()}`);

        if (output.includes('HTTP server listening') && !isResolved) {
          isResolved = true;
          this.isRunning = true;
          setTimeout(() => resolve(), 2000);
        }
      });

      this.cppProcess.stderr?.on('data', data => {
        const error = data.toString();
        console.error(`Whisper.cpp service error: ${error.trim()}`);
      });

      this.cppProcess.on('error', error => {
        console.error('Failed to start Whisper.cpp service:', error);
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      });

      this.cppProcess.on('exit', code => {
        console.log(`Whisper.cpp service exited with code ${code}`);
        this.isRunning = false;
        this.cppProcess = null;
      });

      // 超时处理
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Whisper.cpp service start timeout'));
        }
      }, 30000);
    });
  }

  async stop(): Promise<void> {
    if (this.cppProcess) {
      this.cppProcess.kill('SIGTERM');

      await new Promise<void>(resolve => {
        if (this.cppProcess) {
          this.cppProcess.on('exit', () => resolve());
          setTimeout(() => {
            if (this.cppProcess) {
              this.cppProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
    }

    this.isRunning = false;
    this.cppProcess = null;
    this.startPromise = null;
  }

  async isHealthy(): Promise<boolean> {
    try {
      // whisper.cpp的服务器可能没有专门的health端点，尝试访问根路径
      const response = await axios.get(`${this.serverUrl}/`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.isRunning) {
      throw new Error('Whisper.cpp service is not running');
    }

    // 计算动态超时时间
    const getTranscriptionTimeout = (audioBuffer: Buffer): number => {
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 假设每2MB约1分钟音频
      const transcriptionMinutes = Math.max(estimatedMinutes * 2, 15); // C++版本可能更慢，使用2倍时间，至少15分钟
      return Math.min(transcriptionMinutes * 60 * 1000, 360 * 60 * 1000); // 毫秒，最大360分钟
    };

    const timeoutMs = getTranscriptionTimeout(audioBuffer);
    console.log(`📊 Whisper.cpp 预计转录时间: ${Math.round(timeoutMs/60000)} 分钟，文件大小: ${Math.round(audioBuffer.length/(1024*1024))}MB`);

    const formData = new FormData();
    
    // C++ 服务器期望的字段名
    formData.append('file', audioBuffer, {
      filename: options?.filename || 'audio.wav',
      contentType: 'audio/wav',
    });

    if (options?.language) {
      formData.append('language', options.language === 'zh-cn' ? 'zh' : options.language);
    }

    if (options?.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    // 强制使用 JSON 格式
    formData.append('response_format', 'json');

    try {
      const response = await axios.post(
        `${this.serverUrl}/inference`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: timeoutMs,
        }
      );

      const result = response.data;
      
      // 处理C++服务器的响应格式
      return {
        text: result.text || '',
        language: result.language,
        segments: result.segments?.map((seg: any) => ({
          start: seg.start || seg.t0,
          end: seg.end || seg.t1,
          text: seg.text,
          confidence: seg.confidence,
        })),
        duration: result.duration,
        model: 'whisper.cpp',
      };
    } catch (error: any) {
      console.error('Whisper.cpp transcription error:', error);
      throw new Error(`Whisper.cpp transcription failed: ${error.message}`);
    }
  }
}

// OpenAI Whisper引擎（通过API调用）
class OpenAIWhisperEngine implements WhisperService {
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(apiKey: string, baseURL = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async start(): Promise<void> {
    // OpenAI API不需要启动服务
  }

  async stop(): Promise<void> {
    // OpenAI API不需要停止服务
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    // 计算动态超时时间
    const getTranscriptionTimeout = (audioBuffer: Buffer): number => {
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 假设每2MB约1分钟音频
      const transcriptionMinutes = Math.max(estimatedMinutes * 0.3, 5); // OpenAI API更快，使用0.3倍时间，至少5分钟
      return Math.min(transcriptionMinutes * 60 * 1000, 360 * 60 * 1000); // 毫秒，最大360分钟
    };

    const timeoutMs = getTranscriptionTimeout(audioBuffer);
    console.log(`📊 OpenAI Whisper 预计转录时间: ${Math.round(timeoutMs/60000)} 分钟，文件大小: ${Math.round(audioBuffer.length/(1024*1024))}MB`);

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: options?.filename || 'audio.wav',
        contentType: 'audio/wav',
      });
      formData.append('model', options?.model || 'whisper-1');

      if (options?.language) {
        formData.append('language', options.language);
      }

      const response = await axios.post(
        `${this.baseURL}/audio/transcriptions`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: timeoutMs,
        }
      );

      return {
        text: response.data.text || '',
        language: response.data.language || options?.language || 'unknown',
        confidence: 0.95,
        duration: (Date.now() - startTime) / 1000,
        segments: [], // OpenAI API默认不返回segments
        model: options?.model || 'whisper-1',
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI转录失败: ${message}`);
      }
      throw new Error(
        `OpenAI转录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// 引擎管理器
export class WhisperEngineManager {
  private engines: Map<WhisperEngineType, WhisperService> = new Map();
  private configs: Map<WhisperEngineType, WhisperEngineConfig> = new Map();

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // Faster-Whisper配置
    this.configs.set('faster-whisper', {
      type: 'faster-whisper',
      port: 8178,
      enabled: true,
      description: 'Python based faster-whisper engine with GPU support',
      features: {
        realTimeProgress: true,
        multiLanguage: true,
        gpu: true,
        performance: 'high',
        memoryUsage: 'medium',
      },
    });

    // Whisper.cpp配置  
    this.configs.set('whisper-cpp', {
      type: 'whisper-cpp',
      port: 8081,
      enabled: true,
      description: 'Native C++ implementation with high performance',
      features: {
        realTimeProgress: false,
        multiLanguage: true,
        gpu: false,
        performance: 'high',
        memoryUsage: 'low',
      },
    });

    // OpenAI配置
    this.configs.set('openai', {
      type: 'openai',
      enabled: true,
      description: 'OpenAI Whisper API service',
      features: {
        realTimeProgress: false,
        multiLanguage: true,
        gpu: true,
        performance: 'high',
        memoryUsage: 'low',
      },
    });
  }

  getEngineConfig(type: WhisperEngineType): WhisperEngineConfig | undefined {
    return this.configs.get(type);
  }

  getAllConfigs(): WhisperEngineConfig[] {
    return Array.from(this.configs.values());
  }

  async createEngine(type: WhisperEngineType, options?: any): Promise<WhisperService> {
    // 检查是否已存在
    if (this.engines.has(type)) {
      const existing = this.engines.get(type)!;
      const isHealthy = await existing.isHealthy();
      if (isHealthy) {
        return existing;
      }
    }

    // 创建新引擎
    let engine: WhisperService;
    
    switch (type) {
      case 'faster-whisper':
        engine = new LocalWhisperEngine(options);
        break;
      case 'whisper-cpp':
        engine = new WhisperCppEngine(options);
        break;
      case 'openai':
        if (!options?.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        engine = new OpenAIWhisperEngine(options.apiKey);
        break;
      default:
        throw new Error(`Unsupported engine type: ${type}`);
    }

    // 启动引擎
    await engine.start();
    this.engines.set(type, engine);
    
    return engine;
  }

  async getEngineStatus(type: WhisperEngineType): Promise<WhisperEngineStatus> {
    const engine = this.engines.get(type);
    const config = this.configs.get(type);
    
    if (!engine || !config) {
      return {
        type,
        status: 'stopped',
        lastCheck: new Date().toISOString(),
      };
    }

    try {
      const isHealthy = await engine.isHealthy();
      return {
        type,
        status: isHealthy ? 'running' : 'stopped',
        port: config.port,
        lastCheck: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        type,
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async stopEngine(type: WhisperEngineType): Promise<void> {
    const engine = this.engines.get(type);
    if (engine) {
      await engine.stop();
      this.engines.delete(type);
    }
  }

  async stopAllEngines(): Promise<void> {
    const stopPromises = Array.from(this.engines.keys()).map(type => this.stopEngine(type));
    await Promise.all(stopPromises);
  }
}

// 全局引擎管理器实例
export const whisperEngineManager = new WhisperEngineManager();

// 更新的工厂函数
export function createWhisperEngine(
  type: TranscriptionEngineType = 'local',
  engineType?: WhisperEngineType,
  options?: {
    apiKey?: string;
    serverUrl?: string;
    serverPort?: number;
    modelPath?: string;
  }
): WhisperService {
  if (type === 'local') {
    // 本地引擎，支持选择具体类型
    const whisperType = engineType || 'faster-whisper';
    
    switch (whisperType) {
      case 'faster-whisper':
        return new LocalWhisperEngine(options);
      case 'whisper-cpp':
        return new WhisperCppEngine(options);
      default:
        return new LocalWhisperEngine(options);
    }
  } else if (type === 'openai-whisper' || type === 'whisper-openai') {
    if (!options?.apiKey) {
      throw new Error('OpenAI API key is required for OpenAI engine');
    }
    return new OpenAIWhisperEngine(options.apiKey, options.serverUrl);
  }

  // 默认返回 faster-whisper
  return new LocalWhisperEngine(options);
}

// 默认导出
export default createWhisperEngine;

// 导出类
export { LocalWhisperEngine, OpenAIWhisperEngine };
