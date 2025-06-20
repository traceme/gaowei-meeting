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
  transcribe(audioBuffer: Buffer, filename: string, options?: TranscriptionOptions): Promise<TranscriptionResult>;
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

  async transcribe(audioBuffer: Buffer, filename: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    console.log(`🎯 开始faster-whisper转录，文件: ${filename}, 大小: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer]);
    formData.append('file', audioBlob, filename);
    
    if (options?.language) {
      formData.append('language', options.language);
      console.log(`📝 指定语言: ${options.language}`);
    }

    try {
      const response = await fetch(`${this.baseURL}/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`本地Whisper转录失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📄 faster-whisper响应类型: ${result.task_id ? '异步任务' : '同步结果'}`);
      
      // 如果是异步任务，轮询结果
      if (result.task_id) {
        console.log(`⏳ 异步任务开始，任务ID: ${result.task_id}`);
        console.log(`📊 预估处理时间: ${result.estimated_time_minutes?.toFixed(1) || '未知'} 分钟`);
        return await this.pollLocalWhisperTask(result.task_id, result.estimated_time_minutes || 10);
      }
      
      // 同步结果直接返回
      console.log(`✅ 同步转录完成，文本长度: ${result.text?.length || 0}字符`);
      return {
        text: result.text || '',
        segments: result.segments || [],
        language: result.language || 'unknown',
      };
    } catch (error) {
      console.error(`faster-whisper调用失败: ${error}`);
      throw error;
    }
  }

  private async pollLocalWhisperTask(taskId: string, estimatedMinutes: number = 10): Promise<TranscriptionResult> {
    let attempts = 0;
    // 动态计算最大轮询次数：预估时间 * 2 + 基础时间，最少20次，最多120次
    const baseAttempts = 20; // 基础10分钟
    const extraAttempts = Math.floor(estimatedMinutes * 2); // 预估时间的2倍
    const maxAttempts = Math.min(Math.max(baseAttempts + extraAttempts, baseAttempts), 120); // 最多60分钟
    
    console.log(`🔄 开始轮询任务状态，预估${estimatedMinutes.toFixed(1)}分钟，最多轮询${maxAttempts}次`);

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseURL}/status/${taskId}`, {
          signal: AbortSignal.timeout(10000), // 10秒超时
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`任务${taskId}不存在或已过期`);
          }
          throw new Error(`获取任务状态失败: ${response.status} ${response.statusText}`);
        }

        const status = await response.json();
        
        // 显示详细进度信息
        if (attempts % 6 === 0) { // 每30秒打印一次进度
          console.log(`📊 任务${taskId}状态: ${status.status}, 进度: ${status.progress || '处理中...'}`);
          if (status.segments_processed) {
            console.log(`📝 已处理片段: ${status.segments_processed}`);
          }
        }
        
        if (status.status === 'completed' && status.result) {
          console.log(`✅ 异步转录完成！文本长度: ${status.result.text?.length || 0}字符`);
          console.log(`📊 最终统计: 片段数量: ${status.result.segments?.length || 0}`);
          
          return {
            text: status.result.text || '',
            segments: status.result.segments || [],
            language: status.result.language || 'unknown',
          };
        }
        
        if (status.status === 'error') {
          throw new Error(`本地Whisper转录失败: ${status.error || '未知错误'}`);
        }

        // 动态调整轮询间隔
        let pollInterval = 5000; // 默认5秒
        if (attempts < 12) {
          pollInterval = 5000; // 前1分钟，每5秒
        } else if (attempts < 60) {
          pollInterval = 10000; // 前5分钟，每10秒  
        } else {
          pollInterval = 30000; // 后续每30秒
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        
      } catch (error) {
        console.error(`轮询本地Whisper状态失败 (尝试${attempts + 1}/${maxAttempts}): ${error}`);
        attempts++;
        
        // 失败时使用较短间隔重试
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`本地Whisper转录超时 (轮询${maxAttempts}次，约${Math.floor(maxAttempts * 5 / 60)}分钟)`);
  }
}

// 远程faster-whisper引擎 (10.2.0.16)
export class RemoteWhisperEngine implements TranscriptionEngine {
  name = 'remote-whisper';
  private baseURL = 'http://10.2.0.16:8501'; // 远程服务器

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/transcribe`, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok || response.status === 405; // OPTIONS可能返回405但服务可用
    } catch (error) {
      console.log(`远程Whisper服务不可用: ${error}`);
      return false;
    }
  }

  async transcribe(audioBuffer: Buffer, filename: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer]);
    formData.append('file', audioBlob, filename);
    
    if (options?.language) {
      formData.append('language', options.language);
    }

    console.log(`🌐 调用远程Whisper服务: ${this.baseURL}/api/transcribe`);

    const response = await fetch(`${this.baseURL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`远程Whisper转录失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`📄 远程服务响应:`, result);
    
    // 根据LocalAudioTran-LLM-Summar的响应格式适配
    if (result.transcription) {
      return {
        text: result.transcription,
        segments: [], // 该服务目前不提供时间戳段落
        language: result.language || 'unknown',
      };
    }
    
    // 如果是异步任务，轮询结果
    if (result.task_id) {
      return await this.pollRemoteWhisperTask(result.task_id);
    }
    
    // 尝试处理其他可能的响应格式
    return {
      text: result.text || result.transcription || '转录内容不可用',
      segments: result.segments || [],
      language: result.language || 'unknown',
    };
  }

  private async pollRemoteWhisperTask(taskId: string): Promise<TranscriptionResult> {
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询5分钟

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseURL}/status/${taskId}`);
        
        if (!response.ok) {
          throw new Error('获取远程任务状态失败');
        }

        const status = await response.json();
        
        if (status.status === 'completed' && status.result) {
          return {
            text: status.result.text,
            segments: status.result.segments || [],
            language: status.result.language || 'unknown',
          };
        }
        
        if (status.status === 'error') {
          throw new Error(`远程Whisper转录失败: ${status.error}`);
        }

        // 继续等待
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等5秒
        attempts++;
        
      } catch (error) {
        console.error(`轮询远程Whisper状态失败: ${error}`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('远程Whisper转录超时');
  }
}

// OpenAI Whisper API引擎
export class OpenAIWhisperEngine implements TranscriptionEngine {
  name = 'openai-whisper';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async transcribe(audioBuffer: Buffer, filename: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer]);
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    
    if (options?.language) {
      formData.append('language', options.language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Whisper转录失败: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
      text: result.text,
      segments: result.segments || [],
      language: result.language || 'unknown',
    };
  }
}

// 转录引擎路由器
export class TranscriptionRouter {
  private engines: TranscriptionEngine[] = [];

  constructor() {
    // 注册所有可用引擎
    this.engines.push(new LocalWhisperEngine());
    this.engines.push(new RemoteWhisperEngine());
    
    // 如果有OpenAI API Key，添加OpenAI引擎
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.engines.push(new OpenAIWhisperEngine(openaiKey));
    }
  }

  async transcribe(audioBuffer: Buffer, filename: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    // 检查所有引擎的可用性
    const availableEngines = [];
    
    for (const engine of this.engines) {
      try {
        const isAvailable = await engine.isAvailable();
        if (isAvailable) {
          availableEngines.push(engine);
          console.log(`✅ ${engine.name} 引擎可用`);
        } else {
          console.log(`❌ ${engine.name} 引擎不可用`);
        }
      } catch (error) {
        console.log(`❌ ${engine.name} 引擎检查失败: ${error}`);
      }
    }

    if (availableEngines.length === 0) {
      throw new Error('没有可用的转录引擎');
    }

    // 智能选择引擎 (优先级: 本地 > 远程 > 外部API)
    const priorityOrder = ['local-whisper', 'remote-whisper', 'openai-whisper'];
    let selectedEngine = availableEngines[0];
    
    for (const engineName of priorityOrder) {
      const engine = availableEngines.find(e => e.name === engineName);
      if (engine) {
        selectedEngine = engine;
        break;
      }
    }

    console.log(`🎯 选择引擎: ${selectedEngine.name} 处理文件: ${filename}`);

    try {
      return await selectedEngine.transcribe(audioBuffer, filename, options);
    } catch (error) {
      console.error(`${selectedEngine.name} 转录失败: ${error}`);
      
      // 如果首选引擎失败，尝试其他引擎
      const remainingEngines = availableEngines.filter(e => e !== selectedEngine);
      
      for (const fallbackEngine of remainingEngines) {
        try {
          console.log(`🔄 尝试备用引擎: ${fallbackEngine.name}`);
          return await fallbackEngine.transcribe(audioBuffer, filename, options);
        } catch (fallbackError) {
          console.error(`备用引擎 ${fallbackEngine.name} 也失败: ${fallbackError}`);
        }
      }
      
      throw new Error(`所有转录引擎都失败了。最后错误: ${error}`);
    }
  }

  async getEngineStatus(): Promise<Array<{ name: string; available: boolean }>> {
    const status = [];
    
    for (const engine of this.engines) {
      try {
        const available = await engine.isAvailable();
        status.push({ name: engine.name, available });
      } catch (error) {
        status.push({ name: engine.name, available: false });
      }
    }
    
    return status;
  }
}