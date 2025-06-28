import { Router, type Request, type Response } from 'express';
import type { IRouter } from 'express';
import { readFile } from 'fs/promises';
import FormData from 'form-data';
import axios from 'axios';
import { MeetingManager } from '../services/meeting.js';
import {
  TranscriptionRouter,
  type TranscriptionOptions,
} from '../services/transcription.js';
import { AISummaryGenerator } from '../services/ai-summary.js';
import { appConfig } from '../config/index.js';
import { sendSuccess, sendError } from '../middleware/index.js';
import type { WhisperEngineType } from '@gaowei/shared-types';

// 获取音频文件元数据（时长等）的工具函数
async function getAudioMetadata(filePath: string): Promise<{ duration?: number; format?: string }> {
  try {
    // 尝试使用ffprobe获取音频信息（如果可用）
    const { execSync } = await import('child_process');
    
    try {
      // 使用ffprobe获取精确的音频时长
      const output = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf8', timeout: 5000 }
      );
      
      const duration = parseFloat(output.trim());
      if (!isNaN(duration) && duration > 0) {
        console.log(`📊 使用ffprobe获取音频时长: ${duration}秒`);
        return { duration };
      }
    } catch (ffprobeError) {
      console.warn('⚠️ ffprobe不可用，使用文件大小估算音频时长');
    }
    
    // 回退方案：根据文件大小粗略估算音频时长
    const { statSync } = await import('fs');
    const stats = statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // 假设音频比特率约为128kbps，计算大概时长
    // 1MB ≈ 1分钟的音频（在128kbps下）
    const estimatedDurationMinutes = fileSizeMB * 1.0; // 粗略估算
    const estimatedDurationSeconds = Math.round(estimatedDurationMinutes * 60);
    
    console.log(`📊 根据文件大小估算音频时长: ${estimatedDurationSeconds}秒 (${fileSizeMB.toFixed(1)}MB)`);
    return { duration: estimatedDurationSeconds };
    
  } catch (error) {
    console.warn('⚠️ 获取音频元数据失败:', error);
    return {};
  }
}

// 格式化音频时长为可读格式
function formatAudioDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

const router: IRouter = Router();
let meetingManager: MeetingManager;
let transcriptionRouter: TranscriptionRouter;
let aiSummaryGenerator: AISummaryGenerator;

// 获取当前选择的引擎
async function getCurrentEngine(): Promise<WhisperEngineType> {
  try {
    const response = await fetch('http://localhost:3000/api/engine/current');
    if (response.ok) {
      const data = await response.json();
      return data.data?.engine || 'faster-whisper';
    }
  } catch (error) {
    console.warn('获取当前引擎失败，使用默认引擎:', error);
  }
  return 'faster-whisper';
}

// 初始化服务
const initializeServices = () => {
  if (!meetingManager) {
    meetingManager = new MeetingManager();
  }
  if (!transcriptionRouter) {
    transcriptionRouter = new TranscriptionRouter(appConfig);
  }
  if (!aiSummaryGenerator) {
    aiSummaryGenerator = new AISummaryGenerator(appConfig);
  }
  return { meetingManager, transcriptionRouter, aiSummaryGenerator };
};

// 文件上传和转录
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();

    if (!req.file) {
      return sendError(res, '未上传文件', 400);
    }

    const { meetingId, language, filename_base64 } = req.body;
    let currentMeetingId = meetingId;
    
    // 处理Base64编码的文件名
    let displayFilename = req.file.originalname;
    if (filename_base64) {
      try {
        // 解码Base64文件名
        const decodedFilename = decodeURIComponent(Buffer.from(filename_base64, 'base64').toString());
        displayFilename = decodedFilename;
        console.log(`📁 文件名Base64解码成功: ${req.file.originalname} -> ${displayFilename}`);
      } catch (error) {
        console.warn('文件名Base64解码失败:', error);
        displayFilename = req.file.originalname;
      }
    }
    console.log(`📁 最终使用文件名: ${displayFilename}`);

    // 如果没有提供会议ID，创建新会议
    if (!currentMeetingId) {
      const meeting = await meetingManager.createMeeting(
        `会议转录 - ${displayFilename}`,
        `上传文件: ${displayFilename}`
      );
      currentMeetingId = meeting.id;
    }

    // 获取音频文件元数据（时长等）
    const audioMetadata = await getAudioMetadata(req.file.path);
    const duration = audioMetadata.duration;
    const formattedDuration = duration ? formatAudioDuration(duration) : undefined;
    
    console.log(`📊 音频文件信息: ${displayFilename}, 时长: ${formattedDuration || '未知'}`);

    // 创建转录任务，包含音频时长信息
    const task = await meetingManager.createTranscriptionTask(
      currentMeetingId,
      displayFilename,
      formattedDuration,
      duration
    );

    // 更新会议状态
    await meetingManager.updateMeeting(currentMeetingId, {
      status: 'transcribing',
      audioPath: req.file.path,
    });

    // 开始异步转录
    processTranscriptionInBackground(
      task.id,
      req.file.path, // 使用文件路径而不是buffer
      displayFilename,
      {
        // 只有在语言不是'auto'且存在时才传递语言参数
        ...(language && language !== 'auto' ? { language: language as string } : {}),
      }
    );

    sendSuccess(res, {
      message: '文件上传成功，转录已开始',
      meetingId: currentMeetingId,
      taskId: task.id,
      createdAt: task.created_at, // 添加任务创建时间
      filename: task.filename,    // 添加正确的文件名
      duration: task.duration,    // 添加音频时长
    });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '文件上传失败',
      500
    );
  }
});

// 转录状态查询
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();
    const task = await meetingManager.getTranscriptionTask(req.params.taskId!);

    if (!task) {
      return sendError(res, '转录任务不存在', 404);
    }

    // 同时获取相关会议信息以获取音频路径
    const meeting = await meetingManager.getMeeting(task.meeting_id);
    
    // 构建包含音频路径的完整任务数据
    const taskWithAudioPath = {
      ...task,
      // 从会议的 audio_path 中提取实际文件名
      audio_path: meeting?.audioPath,
      // 如果有音频路径，从中提取相对文件名供前端使用
      actual_filename: meeting?.audioPath ? 
        meeting.audioPath.split('/').pop() : task.filename,
    };

    
    sendSuccess(res, { task: taskWithAudioPath });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取转录状态失败',
      500
    );
  }
});

// 获取转录引擎状态
router.get('/engines/status', async (req: Request, res: Response) => {
  try {
    const { transcriptionRouter } = initializeServices();
    const status = await transcriptionRouter.getEngineStatus();

    sendSuccess(res, { engines: status });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取引擎状态失败',
      500
    );
  }
});

// 获取所有转录任务列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();
    const { status, search, limit, offset } = req.query;

    const filters = {
      status: status as string,
      title: search as string,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    };

    const tasks = await meetingManager.getAllTranscriptionTasks(filters);
    
    sendSuccess(res, {
      tasks,
      total: tasks.length,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取转录任务列表失败',
      500
    );
  }
});

// 为转录任务生成AI摘要
router.post('/:taskId/summary', async (req: Request, res: Response) => {
  try {
    const { meetingManager, aiSummaryGenerator } = initializeServices();
    const { taskId } = req.params;
    const { model } = req.body;

    if (!taskId) {
      return sendError(res, '任务ID不能为空', 400);
    }

    // 获取转录任务
    const task = await meetingManager.getTranscriptionTask(taskId);
    if (!task) {
      return sendError(res, '转录任务不存在', 404);
    }

    if (task.status !== 'completed' || !task.result?.text) {
      return sendError(res, '转录任务未完成或没有转录文本', 400);
    }

    console.log(`🤖 开始为任务 ${taskId} 生成AI摘要...`);

    // 生成摘要
    const summaryResult = await aiSummaryGenerator.generateSummary(
      task.result.text,
      model
    );

    // 提取关键词（简单实现）
    const keywords = extractKeywords(task.result.text);

    // 更新任务记录，添加摘要信息
    await meetingManager.updateTranscriptionTask(taskId, {
      result: {
        ...task.result,
        // summary和keywords不在TranscriptionResult中，我们通过其他方式存储
      },
      // 将摘要信息存储在任务级别
      summary: {
        text: summaryResult.text,
        model: summaryResult.model,
        created_at: summaryResult.createdAt,
      },
    });

    console.log(`✅ 任务 ${taskId} AI摘要生成完成`);

    sendSuccess(res, {
      summary: summaryResult.text,
      keywords: keywords,
      model: summaryResult.model,
      provider: summaryResult.provider,
      createdAt: summaryResult.createdAt,
    });
  } catch (error) {
    console.error(`❌ 任务 ${req.params.taskId} AI摘要生成失败:`, error);
    sendError(
      res,
      error instanceof Error ? error.message : 'AI摘要生成失败',
      500
    );
  }
});

// 简单的关键词提取函数
function extractKeywords(text: string): string[] {
  // 这是一个简单的关键词提取实现
  // 在实际项目中，你可能想要使用更复杂的NLP库
  const words = text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '') // 保留中文、英文、数字和空格
    .split(/\s+/)
    .filter(word => word.length > 1); // 过滤掉单字符

  // 计算词频
  const wordCount: { [key: string]: number } = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // 过滤常见停用词（简化版）
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '这个', '那', '那个', '我们', '你们', '他们', '她们', '它们', '这些', '那些', '什么', '怎么', '为什么', '哪里', '怎样', '多少',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);

  // 获取频率最高的关键词
  const filteredWords = Object.entries(wordCount)
    .filter(([word, count]) => !stopWords.has(word) && count >= 2) // 至少出现2次
    .sort(([, a], [, b]) => b - a) // 按频率降序排列
    .slice(0, 10) // 取前10个
    .map(([word]) => word);

  return filteredWords;
}

// 后台转录处理函数
async function processTranscriptionInBackground(
  taskId: string,
  audioFilePath: string,
  filename: string,
  options: TranscriptionOptions
) {
  const { meetingManager, transcriptionRouter } = initializeServices();

  try {
    // 更新任务状态为进行中
    await meetingManager.updateTranscriptionTask(taskId, {
      status: 'processing',
      progress: 5,
    });

    // 读取音频文件
    const audioBuffer = await readFile(audioFilePath);
    
    // 获取当前选择的引擎
    const currentEngine = await getCurrentEngine();
    console.log(`🎙️ 开始转录任务 ${taskId}，使用引擎: ${currentEngine}...`);
    
        // 如果选择了OpenAI引擎，直接使用统一的引擎路由器
    if (currentEngine === 'openai') {
      console.log('🌐 使用OpenAI引擎进行转录...');
      
      const result = await transcriptionRouter.transcribe(
        audioBuffer,
        filename,
        {
          ...options,
          engineType: 'openai',
        }
      );

      await meetingManager.updateTranscriptionTask(taskId, {
        status: 'completed',
        progress: 100,
        result: result,
      });

      console.log(`✅ 转录任务 ${taskId} 完成（OpenAI）`);
      return;
    }
    
    // 根据选择的引擎确定服务器URL
    let whisperServerUrl: string;
    switch (currentEngine) {
      case 'whisper-cpp':
        whisperServerUrl = 'http://localhost:8081';
        break;
      case 'faster-whisper':
      default:
        whisperServerUrl = appConfig.whisper.serverUrl || 'http://localhost:8178';
        break;
    }
    
    console.log(`🔧 使用服务器: ${whisperServerUrl}`);
    
    // 计算音频时长估算超时时间
    const getTranscriptionTimeout = (audioBuffer: Buffer): number => {
      // 基于文件大小估算音频时长（粗略估计）
      const fileSizeMB = audioBuffer.length / (1024 * 1024);
      const estimatedMinutes = Math.max(fileSizeMB / 2, 1); // 假设每2MB约1分钟音频
      
      // 转录时间通常是音频时长的0.5-1倍（取决于模型和硬件）
      const transcriptionMinutes = Math.max(estimatedMinutes * 1, 10); // 至少10分钟
      
      // 最大360分钟超时，防止无限等待
      return Math.min(transcriptionMinutes * 60, 360 * 60); // 秒数
    };
    
    const timeoutSeconds = getTranscriptionTimeout(audioBuffer);
    const maxAttempts = timeoutSeconds; // 每秒轮询一次
    
    console.log(`📊 预计转录时间: ${Math.round(timeoutSeconds/60)} 分钟，文件大小: ${Math.round(audioBuffer.length/(1024*1024))}MB`);
    
    try {
      // 发送转录请求到Whisper服务
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: filename,
        contentType: 'audio/wav',
      });
      
      // 处理混合语言模式
      if (options.language === 'mixed') {
        console.log('🌐 启用混合语言模式（中英文）');
        // 混合语言模式：先用中文处理，如果效果不好再用英文补充
        // 这里先使用中文作为主语言，whisper模型会自动处理其中的英文部分
        const languageCode = currentEngine === 'whisper-cpp' ? 'zh' : 'zh';
        formData.append('language', languageCode);
        // 可以在后续版本中实现多pass处理
      } else if (options.language) {
        // whisper.cpp使用不同的语言代码格式
        let languageCode = options.language;
        if (currentEngine === 'whisper-cpp') {
          // 将zh-cn转换为zh，因为whisper.cpp使用ISO 639-1格式
          if (languageCode === 'zh-cn' || languageCode === 'zh-CN') {
            languageCode = 'zh';
          }
        }
        formData.append('language', languageCode);
      }

      // 为所有支持的引擎启用词级时间戳以支持音频播放功能
      if (currentEngine === 'whisper-cpp') {
        formData.append('word_timestamps', 'true');
        formData.append('response_format', 'verbose_json');
      } else if (currentEngine === 'faster-whisper') {
        formData.append('word_timestamps', 'true');
        formData.append('response_format', 'verbose_json');
      }

      const response = await axios.post(`${whisperServerUrl}/inference`, formData, {
        headers: formData.getHeaders(),
      });

      if (!response.data) {
        throw new Error(`Whisper服务响应错误: ${response.status} ${response.statusText}`);
      }

      const whisperResult = response.data;
      const whisperTaskId = whisperResult.task_id;

      if (whisperTaskId) {
        console.log(`📋 Whisper任务ID: ${whisperTaskId}, 开始轮询进度...`);
        
        // 轮询Whisper服务的进度
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          try {
            const statusResponse = await axios.get(`${whisperServerUrl}/status/${whisperTaskId}`);
            
            if (statusResponse.data) {
              const status = statusResponse.data;
              
              // 更新数据库中的进度
              if (status.progress !== undefined) {
                await meetingManager.updateTranscriptionTask(taskId, {
                  status: 'processing',
                  progress: Math.min(status.progress, 99), // 最高99%，留1%给最终处理
                });
                console.log(`📊 任务 ${taskId} 进度更新: ${status.progress}%`);
              }
              
              if (status.status === 'completed' && status.result) {
                // 转录完成，处理结果
                console.log('🔍 faster-whisper异步响应调试信息:');
                console.log(`- segments数量: ${status.result.segments?.length || 0}`);
                console.log(`- 第一个segment的keys: ${status.result.segments?.[0] ? Object.keys(status.result.segments[0]).join(', ') : 'N/A'}`);
                console.log(`- 第一个segment有words: ${status.result.segments?.[0]?.words ? '是' : '否'}`);
                console.log(`- words数量: ${status.result.segments?.[0]?.words?.length || 0}`);
                
                // 调试：保存完整的faster-whisper响应到文件
                try {
                  const { writeFileSync } = await import('fs');
                  const debugData = {
                    timestamp: new Date().toISOString(),
                    taskId,
                    engine: currentEngine,
                    whisperResult: status.result,
                  };
                  writeFileSync(`/tmp/whisper-debug-${taskId}.json`, JSON.stringify(debugData, null, 2));
                  console.log(`📋 调试数据已保存到 /tmp/whisper-debug-${taskId}.json`);
                } catch (debugError) {
                  console.warn('调试文件写入失败:', debugError);
                }
                
                // 🔧 修复：如果segments没有words字段，基于文本生成简单的词级时间戳
                const processedSegments = (status.result.segments || []).map((segment: any) => {
                  if (!segment.words || segment.words.length === 0) {
                    // 如果没有词级时间戳，基于segment文本生成简单的词分割
                    const words = segment.text?.trim().split(/\s+/) || [];
                    const segmentDuration = segment.end - segment.start;
                    const wordsPerSecond = words.length / segmentDuration;
                    
                    segment.words = words.map((word: string, index: number) => {
                      const wordDuration = 1 / wordsPerSecond;
                      const wordStart = segment.start + (index * wordDuration);
                      const wordEnd = Math.min(wordStart + wordDuration, segment.end);
                      
                      return {
                        word: word,
                        start: Number(wordStart.toFixed(3)),
                        end: Number(wordEnd.toFixed(3)),
                        probability: 0.9 // 估算的置信度
                      };
                    });
                    
                    console.log(`🔧 为segment生成了${segment.words.length}个词级时间戳`);
                  }
                  return segment;
                });

                const result = {
                  text: status.result.text || '',
                  language: status.result.language || 'unknown',
                  duration: status.result.duration || 0,
                  confidence: 0.95,
                  segments: processedSegments,
                };
                
                
                // 更新任务状态为完成
                await meetingManager.updateTranscriptionTask(taskId, {
                  status: 'completed',
                  progress: 100,
                  result: result,
                });
                
                console.log(`✅ 转录任务 ${taskId} 完成`);
                return;
              }
              
              if (status.status === 'error') {
                throw new Error(`Whisper转录失败: ${status.error || '未知错误'}`);
              }
            }
          } catch (pollError) {
            console.warn(`⚠️ 轮询进度失败 (尝试 ${attempts + 1}):`, pollError);
          }
          
          // 等待1秒后继续轮询
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        throw new Error('转录任务超时');
      } else {
        // 直接返回结果的情况（同步处理）
        console.log('🔍 whisper.cpp同步响应调试信息:');
        console.log(`- segments数量: ${whisperResult.segments?.length || 0}`);
        console.log(`- 第一个segment的keys: ${whisperResult.segments?.[0] ? Object.keys(whisperResult.segments[0]).join(', ') : 'N/A'}`);
        console.log(`- 第一个segment有words: ${whisperResult.segments?.[0]?.words ? '是' : '否'}`);
        console.log(`- words数量: ${whisperResult.segments?.[0]?.words?.length || 0}`);
        
        // 调试：保存完整的whisper.cpp响应到文件
        try {
          const { writeFileSync } = await import('fs');
          const debugData = {
            timestamp: new Date().toISOString(),
            taskId,
            engine: currentEngine,
            whisperResult: JSON.parse(JSON.stringify(whisperResult)), // 深拷贝
          };
          writeFileSync(`/tmp/whisper-debug-${taskId}.json`, JSON.stringify(debugData, null, 2));
          console.log(`📋 调试数据已保存到 /tmp/whisper-debug-${taskId}.json`);
        } catch (debugError) {
          console.warn('调试文件写入失败:', debugError);
        }
        
        // 保存完整的segments数据，包括词级时间戳
        const segments = whisperResult.segments || [];
        
        // 🔧 修复：如果segments没有words字段，基于文本生成简单的词级时间戳
        const processedSegments = segments.map((segment: any) => {
          if (!segment.words || segment.words.length === 0) {
            // 如果没有词级时间戳，基于segment文本生成简单的词分割
            const words = segment.text?.trim().split(/\s+/) || [];
            const segmentDuration = segment.end - segment.start;
            const wordsPerSecond = words.length / segmentDuration;
            
            segment.words = words.map((word: string, index: number) => {
              const wordDuration = 1 / wordsPerSecond;
              const wordStart = segment.start + (index * wordDuration);
              const wordEnd = Math.min(wordStart + wordDuration, segment.end);
              
              return {
                word: word,
                start: Number(wordStart.toFixed(3)),
                end: Number(wordEnd.toFixed(3)),
                probability: 0.9 // 估算的置信度
              };
            });
            
            console.log(`🔧 为segment生成了${segment.words.length}个词级时间戳`);
          }
          return segment;
        });
        
        const result = {
          text: whisperResult.text || '',
          language: whisperResult.detected_language || whisperResult.language || 'unknown',
          duration: whisperResult.duration || 0,
          confidence: 0.95,
          segments: processedSegments,
        };
        
        
        await meetingManager.updateTranscriptionTask(taskId, {
          status: 'completed',
          progress: 100,
          result: result,
        });
        
        console.log(`✅ 转录任务 ${taskId} 完成（同步）`);
      }
    } catch (whisperError) {
      console.warn(`⚠️ ${currentEngine} 服务不可用，使用备用转录引擎...`);
      
             // 根据当前引擎类型选择合适的引擎类型参数
      let engineType: 'local' | 'openai' = 'local';
      // 本地引擎失败，如果有OpenAI API密钥，尝试使用OpenAI
      if (appConfig.ai.providers.openai?.apiKey) {
        console.log('📍 本地引擎失败，尝试使用OpenAI引擎...');
        engineType = 'openai';
      } else {
        console.log('📍 本地引擎失败，尝试其他本地引擎...');
        engineType = 'local';
      }
      
      // 使用备用转录引擎
      const result = await transcriptionRouter.transcribe(
        audioBuffer,
        filename,
        {
          ...options,
          engineType,
        }
      );

      await meetingManager.updateTranscriptionTask(taskId, {
        status: 'completed',
        progress: 100,
        result: result,
      });

      console.log(`✅ 转录任务 ${taskId} 完成（备用引擎: ${engineType}）`);
    }

  } catch (error) {
    // 更新任务状态为失败
    await meetingManager.updateTranscriptionTask(taskId, {
      status: 'error',
      error: error instanceof Error ? error.message : '转录失败',
    });

    console.error(`❌ 转录任务 ${taskId} 失败:`, error);
  }
}

export default router;
