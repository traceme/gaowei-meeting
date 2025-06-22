import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess } from '../middleware/index.js';

// 导入子路由
import meetingsRouter from './meetings.js';
import transcriptionRouter from './transcription.js';
import summaryRouter from './summary.js';
import engineRouter from './engine.js';

const router: IRouter = Router();

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
