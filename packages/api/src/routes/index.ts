import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess } from '../middleware/index.js';

// 导入子路由
// import meetingsRouter from './meetings.js';
// import transcriptionRouter from './transcription.js';
// import settingsRouter from './settings.js';

const router: IRouter = Router();

// 健康检查
router.get('/health', (req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API信息
router.get('/info', (req: Request, res: Response) => {
  sendSuccess(res, {
    name: '高维会议AI API',
    version: '2.0.0',
    description: '统一的会议AI后端服务',
    endpoints: {
      health: '/api/health',
      meetings: '/api/meetings',
      transcription: '/api/transcription',
      settings: '/api/settings',
    },
  });
});

// 挂载子路由
// router.use('/meetings', meetingsRouter);
// router.use('/transcription', transcriptionRouter);
// router.use('/settings', settingsRouter);

export default router; 