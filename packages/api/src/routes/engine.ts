import { Router, type Request, type Response } from 'express';
import type { IRouter } from 'express';
import type { WhisperEngineType, EngineSelectionRequest } from '@gaowei/shared-types';
import { sendSuccess, sendError } from '../middleware/index.js';

const router: IRouter = Router();

// 当前选择的引擎（简单内存存储，生产环境应存储到数据库）
let currentEngine: WhisperEngineType = 'faster-whisper';

// 获取当前引擎
router.get('/current', (req: Request, res: Response) => {
  sendSuccess(res, {
    engine: currentEngine,
  });
});

// 设置引擎
router.post('/select', async (req: Request, res: Response) => {
  try {
    const { engine }: EngineSelectionRequest = req.body;
    
    if (!engine || !['faster-whisper', 'whisper-cpp', 'openai'].includes(engine)) {
      return sendError(res, 'Invalid engine type', 400);
    }

    currentEngine = engine;
    
    sendSuccess(res, {
      engine: currentEngine,
      message: `引擎已切换为 ${engine}`,
    });
  } catch (error) {
    sendError(res, 'Failed to select engine', 500);
  }
});

// 获取引擎状态
router.get('/status', async (req: Request, res: Response) => {
  try {
    const statuses: Record<WhisperEngineType, 'available' | 'unavailable'> = {
      'faster-whisper': 'unavailable',
      'whisper-cpp': 'unavailable', 
      'openai': 'unavailable',
    };

    // 检查 faster-whisper 服务
    try {
      const response = await fetch('http://localhost:8178/', { method: 'GET' });
      if (response.ok) {
        statuses['faster-whisper'] = 'available';
      }
    } catch {
      // 服务不可用
    }

    // 检查 whisper-cpp 服务
    try {
      const response = await fetch('http://localhost:8081/', { method: 'GET' });
      if (response.ok) {
        statuses['whisper-cpp'] = 'available';
      }
    } catch {
      // 服务不可用
    }

    // OpenAI 检查（这里简化为检查环境变量）
    if (process.env.OPENAI_API_KEY) {
      statuses['openai'] = 'available';
    }

    sendSuccess(res, {
      statuses,
      currentEngine,
    });
  } catch (error) {
    sendError(res, 'Failed to get engine status', 500);
  }
});

export default router; 