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
import { appConfig } from '../config/index.js';
import { sendSuccess, sendError } from '../middleware/index.js';
import type { WhisperEngineType } from '@gaowei/shared-types';

const router: IRouter = Router();
let meetingManager: MeetingManager;
let transcriptionRouter: TranscriptionRouter;

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
  return { meetingManager, transcriptionRouter };
};

// 文件上传和转录
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();

    if (!req.file) {
      return sendError(res, '未上传文件', 400);
    }

    const { meetingId, language } = req.body;
    let currentMeetingId = meetingId;

    // 如果没有提供会议ID，创建新会议
    if (!currentMeetingId) {
      const meeting = await meetingManager.createMeeting(
        `会议转录 - ${req.file.originalname}`,
        `上传文件: ${req.file.originalname}`
      );
      currentMeetingId = meeting.id;
    }

    // 创建转录任务
    const task = await meetingManager.createTranscriptionTask(
      currentMeetingId,
      req.file.originalname
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
      req.file.originalname,
      {
        language: language as string,
      }
    );

    sendSuccess(res, {
      message: '文件上传成功，转录已开始',
      meetingId: currentMeetingId,
      taskId: task.id,
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

    sendSuccess(res, { task });
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
      
      if (options.language) {
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
                const result = {
                  text: status.result.text || '',
                  language: status.result.language || 'unknown',
                  duration: status.result.duration || 0,
                  confidence: 0.95,
                  segments: status.result.segments || [],
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
        const result = {
          text: whisperResult.text || '',
          language: whisperResult.detected_language || whisperResult.language || 'unknown',
          duration: whisperResult.duration || 0,
          confidence: 0.95,
          segments: whisperResult.segments || [],
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
