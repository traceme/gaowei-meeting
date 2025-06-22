import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess } from '../middleware/index.js';
import { MeetingManager } from '../services/meeting.js';

// 导入子路由
import meetingsRouter from './meetings.js';
import transcriptionRouter from './transcription.js';
import summaryRouter from './summary.js';
import engineRouter from './engine.js';

const router: IRouter = Router();

// 初始化服务
let meetingManager: MeetingManager;

const initializeServices = () => {
  if (!meetingManager) {
    meetingManager = new MeetingManager();
  }
  return { meetingManager };
};

// 健康检查
router.get('/health', async (req: Request, res: Response) => {
  try {
    // 基础健康检查，详细状态通过各个模块获取
    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : '健康检查失败',
      timestamp: new Date().toISOString(),
    });
  }
});

// 历史记录任务列表 - 专门为HistoryPage设计的端点
router.get('/tasks', async (req: Request, res: Response) => {
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
    console.error('获取任务列表失败:', error);
    sendSuccess(res, {
      tasks: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
  }
});

// 删除任务
router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { meetingManager } = initializeServices();
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '任务ID不能为空',
        timestamp: new Date().toISOString(),
      });
    }

    // 删除任务和相关的会议记录
    const result = await meetingManager.deleteTask(taskId);
    
    if (result) {
      sendSuccess(res, {
        message: '任务删除成功',
        taskId,
      });
    } else {
      res.status(404).json({
        success: false,
        error: '任务不存在或已被删除',
        taskId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除任务失败',
      timestamp: new Date().toISOString(),
    });
  }
});

// API信息
router.get('/info', (req: Request, res: Response) => {
  sendSuccess(res, {
    name: '高维会议AI API',
    version: '2.0.0',
    description: '统一的会议AI后端服务 - Monorepo架构',
    features: [
      '多引擎音频转录（本地Whisper + OpenAI）',
      '多提供商AI摘要（Ollama + OpenAI + Claude）',
      '完整会议生命周期管理',
      '实时任务进度跟踪',
      '容错和降级机制',
      '模块化路由架构',
    ],
    endpoints: {
      health: '/api/health',
      info: '/api/info',
      meetings: '/api/meetings',
      transcription: '/api/transcription',
      summary: '/api/summary',
      engine: '/api/engine',
      upload: '/api/transcription/upload',
      process: '/api/summary/process',
    },
    architecture: {
      type: 'monorepo',
      packages: ['api', 'web', 'ui', 'shared-types', 'whisper-engine'],
      database: 'SQLite with WAL mode',
      services: ['meetings', 'transcription', 'ai-summary'],
    },
  });
});

// 挂载子路由
router.use('/meetings', meetingsRouter);
router.use('/transcription', transcriptionRouter);
router.use('/summary', summaryRouter);
router.use('/engine', engineRouter);

// 兼容性路由 - 为了向后兼容，保留一些旧的端点
router.post('/upload', (req: Request, res: Response) => {
  // 重定向到新的转录上传端点
  res.redirect(307, '/api/transcription/upload');
});

router.post('/process', (req: Request, res: Response) => {
  // 重定向到新的完整处理端点
  res.redirect(307, '/api/summary/process');
});

export default router;
