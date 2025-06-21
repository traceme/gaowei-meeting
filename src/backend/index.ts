import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { TranscriptionRouter, TranscriptionOptions } from './transcription-engines';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 创建转录引擎路由器
const transcriptionRouter = new TranscriptionRouter();

// AI服务配置
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'llama3.2:1b';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;

// AI服务超时配置
const AI_TIMEOUT_MS = 1800000; // 增加到 30 分钟超时

// Ollama工具函数
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.log(`Ollama服务不可用: ${error}`);
    return false;
  }
}

// 智能AI摘要生成服务（支持多提供商容错）
async function generateAISummary(transcriptText: string, model = DEFAULT_MODEL): Promise<string> {
  const prompt = `请对以下会议转录内容进行智能摘要，提取关键要点、决策和行动项。
请严格使用简体中文回答，不要使用繁体中文字符。

转录内容：
"${transcriptText}"

请按以下格式输出摘要：

## 📋 会议摘要

### 🎯 关键要点
- [要点1]
- [要点2]
- [要点3]

### 💡 重要决策
- [决策1]
- [决策2]

### ✅ 行动项
- [行动项1]
- [行动项2]

### 📊 其他信息
- 会议时长：[估算时长]
- 主要参与者：[从内容推断]
- 讨论主题：[主要话题]

请用简洁明了的简体中文回答，重点突出最重要的信息。`;

  // 尝试多个AI服务提供商，按优先级顺序
  const providers = [
    { name: 'Ollama', handler: () => generateOllamaSummary(prompt, model) },
    { name: 'OpenAI', handler: () => generateOpenAISummary(prompt) },
    { name: 'Claude', handler: () => generateClaudeSummary(prompt) },
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`🤖 尝试使用 ${provider.name} 生成摘要...`);
      const result = await Promise.race([
        provider.handler(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`${provider.name} 超时`)), AI_TIMEOUT_MS)
        ),
      ]);
      
      console.log(`✅ ${provider.name} 摘要生成成功`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${provider.name} 失败`);
      console.warn(`❌ ${provider.name} 摘要生成失败:`, lastError.message);
      continue; // 尝试下一个提供商
    }
  }

  // 所有提供商都失败了，返回默认摘要
  console.error('所有AI服务提供商都失败了，返回基础摘要');
  return generateFallbackSummary(transcriptText);
}

// Ollama摘要生成
async function generateOllamaSummary(prompt: string, model: string): Promise<string> {
  // 先检查服务可用性
  if (!(await isOllamaAvailable())) {
    throw new Error('Ollama服务不可用');
  }

  const request = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 1000, // 使用 Ollama 支持的参数名
    },
  };

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Ollama API错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// OpenAI摘要生成
async function generateOpenAISummary(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API密钥未配置');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API错误: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '摘要生成失败';
}

// Claude摘要生成
async function generateClaudeSummary(prompt: string): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error('Claude API密钥未配置');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Claude API错误: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '摘要生成失败';
}

// 备用摘要生成（基于文本长度和简单规则）
function generateFallbackSummary(transcriptText: string): string {
  const textLength = transcriptText.length;
  const estimatedMinutes = Math.max(1, Math.round(textLength / 100)); // 大概估算
  
  return `## 📋 会议摘要 (自动生成)

### 🎯 关键要点
- 会议转录内容共 ${textLength} 字符
- 估算会议时长约 ${estimatedMinutes} 分钟
- 该摘要由于AI服务不可用而自动生成

### 💡 重要决策
- 需要人工审核转录内容以提取具体决策

### ✅ 行动项  
- 建议配置AI服务以获得更准确的摘要
- 可手动分析转录内容提取关键信息

### 📊 其他信息
- 转录状态：已完成
- AI摘要状态：使用备用方案
- 建议：配置OpenAI或Claude API密钥以获得更好的摘要质量`;
}

// 中间件
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'], // 前端地址
  credentials: true
}));
app.use(express.json());

// 静态文件服务 - 为音频文件提供访问
app.use('/uploads', express.static('uploads'));

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 限制
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 文件上传检查: ${file.originalname}, MIME: ${file.mimetype}`);
    
    // 允许的音频文件类型
    const allowedMimeTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'audio/ogg',
      'audio/aiff',
      'audio/x-aiff',
      'audio/flac',
      'application/octet-stream', // 有些文件可能识别为这个类型
    ];
    
    // 允许的文件扩展名
    const allowedExtensions = ['.wav', '.mp3', '.mp4', '.webm', '.ogg', '.aiff', '.flac', '.m4a'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    // 检查MIME类型或文件扩展名
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extensionValid = allowedExtensions.includes(fileExtension);
    
    if (mimeTypeValid || extensionValid) {
      console.log(`✅ 文件格式验证通过: ${file.originalname}`);
      cb(null, true);
    } else {
      console.log(`❌ 不支持的文件格式: ${file.originalname}, MIME: ${file.mimetype}, 扩展名: ${fileExtension}`);
      cb(new Error(`不支持的音频文件格式。支持的格式: ${allowedExtensions.join(', ')}`));
    }
  },
});

// 存储转录任务状态
interface TranscriptionTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  filename: string;
  progress: number;
  result?: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
    language: string;
  };
  summary?: {
    text: string;
    model: string;
    createdAt: string;
  };
  error?: string;
  createdAt: Date;
}

const tasks = new Map<string, TranscriptionTask>();

// 基础健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'gaowei-meeting-ai-backend' 
  });
});

// 转录引擎状态接口
app.get('/api/engines', async (req, res) => {
  try {
    const engineStatus = await transcriptionRouter.getEngineStatus();
    res.json({
      engines: engineStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取引擎状态失败:', error);
    res.status(500).json({ error: '获取引擎状态失败' });
  }
});

// 音频上传和转录接口
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '没有上传音频文件' });
      return;
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const originalFilename = req.file.originalname;
    
    // 将上传的文件重命名为原始文件名，保存在uploads目录中
    const originalPath = path.join('uploads', originalFilename);
    fs.renameSync(req.file.path, originalPath);
    
    // 创建任务记录
    const task: TranscriptionTask = {
      id: taskId,
      status: 'pending',
      filename: originalFilename,
      progress: 0,
      createdAt: new Date(),
    };
    
    tasks.set(taskId, task);

    // 立即返回任务ID，开始异步处理
    res.json({
      taskId,
      status: 'pending',
      message: '文件上传成功，开始处理转录',
    });

    // 异步处理转录，使用新的文件路径
    processTranscription(taskId, originalPath, originalFilename);

  } catch (error) {
    console.error('上传文件错误:', error);
    res.status(500).json({ error: '文件处理失败' });
  }
});

// 查询转录状态
app.get('/api/transcribe/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);
  
  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }
  
  res.json(task);
});

// 获取所有任务列表
app.get('/api/tasks', (req, res) => {
  const taskList = Array.from(tasks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  res.json({
    total: taskList.length,
    tasks: taskList,
  });
});

// AI摘要服务状态接口
app.get('/api/ai/status', async (req, res) => {
  try {
    // 检查各个AI服务提供商状态
    const ollamaAvailable = await isOllamaAvailable();
    const ollamaModels = ollamaAvailable ? await getAvailableModels() : [];
    
    const openaiAvailable = !!OPENAI_API_KEY;
    const claudeAvailable = !!CLAUDE_API_KEY;
    
    // 计算整体可用性
    const anyProviderAvailable = ollamaAvailable || openaiAvailable || claudeAvailable;
    
    res.json({
      available: anyProviderAvailable,
      providers: {
        ollama: {
          available: ollamaAvailable,
          models: ollamaModels,
          baseURL: OLLAMA_BASE_URL,
        },
        openai: {
          available: openaiAvailable,
          model: 'gpt-3.5-turbo',
        },
        claude: {
          available: claudeAvailable,
          model: 'claude-3-haiku-20240307',
        },
      },
      defaultModel: DEFAULT_MODEL,
      timeout: AI_TIMEOUT_MS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取AI服务状态失败:', error);
    res.status(500).json({ error: '获取AI服务状态失败' });
  }
});

// 生成AI摘要接口
app.post('/api/ai/summary', async (req, res) => {
  try {
    const { taskId, text, model } = req.body;
    
    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: '转录文本不能为空' });
      return;
    }

    // 检查Ollama服务可用性
    const available = await isOllamaAvailable();
    if (!available) {
      res.status(503).json({ error: 'AI摘要服务暂时不可用，请稍后重试' });
      return;
    }

    console.log(`🤖 开始为任务 ${taskId || 'unknown'} 生成AI摘要...`);
    console.log(`📝 文本长度: ${text.length} 字符`);

    // 生成摘要
    const summary = await generateAISummary(text, model);
    
    res.json({
      summary,
      model: model || DEFAULT_MODEL,
      textLength: text.length,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ AI摘要生成完成，任务: ${taskId || 'unknown'}`);

  } catch (error) {
    console.error('AI摘要生成失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    res.status(500).json({ 
      error: 'AI摘要生成失败', 
      details: errorMessage 
    });
  }
});

// 获取可用模型列表
async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error('获取模型列表失败');
    }
    
    const data = await response.json();
    return data.models?.map((model: any) => model.name) || [];
  } catch (error) {
    console.error('获取Ollama模型失败:', error);
    return [];
  }
}

// 自动生成摘要（转录完成后异步执行）
async function generateAutoSummary(taskId: string, transcriptText: string) {
  try {
    console.log(`🤖 开始为任务 ${taskId} 生成AI摘要...`);
    console.log(`📝 文本长度: ${transcriptText.length} 字符`);

    // 检查AI服务可用性
    const available = await isOllamaAvailable();
    if (!available) {
      console.log(`❌ Ollama服务不可用，跳过自动摘要生成`);
      return;
    }

    // 检查各个AI服务提供商的可用性
    const ollamaAvailable = await isOllamaAvailable();
    const openaiAvailable = !!OPENAI_API_KEY;
    const claudeAvailable = !!CLAUDE_API_KEY;
    
    if (!ollamaAvailable && !openaiAvailable && !claudeAvailable) {
      console.log(`❌ 所有AI服务都不可用，跳过自动摘要生成`);
      return;
    }

    // 选择最优的模型和服务
    let selectedModel = DEFAULT_MODEL;
    if (ollamaAvailable) {
      const models = await getAvailableModels();
      const preferredModels = ['llama3.2:1b', 'llama3.2:latest', 'qwen2.5:1.5b', DEFAULT_MODEL];
      selectedModel = preferredModels.find(model => models.includes(model)) || DEFAULT_MODEL;
    }

    // 生成摘要
    const summaryText = await generateAISummary(transcriptText, selectedModel);
    
    // 更新任务的摘要信息
    const task = tasks.get(taskId);
    if (task) {
      task.summary = {
        text: summaryText,
        model: selectedModel,
        createdAt: new Date().toISOString(),
      };
    }

    console.log(`✅ AI摘要生成完成，任务: ${taskId}`);

  } catch (error) {
    console.error('AI摘要生成失败:', error);
    // 不影响主转录流程，只记录错误
    const task = tasks.get(taskId);
    if (task) {
      task.summary = {
        text: `⚠️ AI摘要生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        model: 'error',
        createdAt: new Date().toISOString(),
      };
    }
  }
}

// 真实转录处理函数
async function processTranscription(taskId: string, filePath: string, filename: string) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    // 更新状态为处理中
    task.status = 'processing';
    task.progress = 10;

    console.log(`🎙️ 开始处理转录任务: ${taskId}, 文件: ${filename}`);

    // 读取音频文件
    const audioBuffer = fs.readFileSync(filePath);
    
    // 获取文件大小信息
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    console.log(`📁 文件大小: ${fileSizeMB.toFixed(1)}MB`);

    // 更新进度到30%
    task.progress = 30;

    // 设置转录选项
    const transcriptionOptions: TranscriptionOptions = {
      language: 'zh', // 可以从请求参数中获取
      modelSize: 'base', // 可以根据文件大小动态选择
    };

    // 使用转录引擎路由器进行转录
    console.log(`🔍 检查可用的转录引擎...`);
    task.progress = 50;

    const result = await transcriptionRouter.transcribe(audioBuffer, filename, transcriptionOptions);
    
    // 更新进度到90%
    task.progress = 90;

    console.log(`✅ 转录完成，文本长度: ${result.text.length}字符，语言: ${result.language}`);

    // 更新任务状态为完成
    task.status = 'completed';
    task.progress = 100;
    task.result = result;

    console.log(`🎉 转录任务 ${taskId} 完成处理`);

    // 自动生成AI摘要（异步进行，不阻塞转录完成响应）
    generateAutoSummary(taskId, result.text);

  } catch (error) {
    console.error(`❌ 转录任务 ${taskId} 处理失败:`, error);
    task.status = 'error';
    task.error = error instanceof Error ? error.message : '未知错误';
    
    // 如果所有转录引擎都失败，提供降级方案
    if (task.error.includes('所有转录引擎都失败了') || task.error.includes('没有可用的转录引擎')) {
      console.log(`🔄 使用模拟结果作为降级方案`);
      
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      const fallbackResult = {
        text: `⚠️ 暂时无法连接到转录服务，这是文件 "${filename}" 的模拟结果。文件大小: ${fileSizeMB.toFixed(1)}MB。请检查转录引擎状态或稍后重试。`,
        segments: [
          {
            start: 0.0,
            end: 5.0,
            text: `⚠️ 暂时无法连接到转录服务，这是文件 "${filename}" 的模拟结果。`,
          },
          {
            start: 5.0,
            end: 8.0,
            text: `文件大小: ${fileSizeMB.toFixed(1)}MB。请检查转录引擎状态或稍后重试。`,
          },
        ],
        language: 'zh',
      };
      
      task.status = 'completed';
      task.progress = 100;
      task.result = fallbackResult;
      task.error = undefined; // 清除错误，因为我们提供了降级结果
    }
  } finally {
    // 不再删除文件，保留用于前端播放
    console.log(`📁 音频文件已保存到: ${filePath}`);
  }
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 高维会议AI后端服务启动成功！`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/health`);
  console.log(`📝 API文档: http://localhost:${PORT}/api`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在优雅关闭服务...');
  process.exit(0);
});
 