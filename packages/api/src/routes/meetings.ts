import { Router, type Request, type Response } from 'express';
import type { IRouter } from 'express';
import { MeetingManager } from '../services/meeting.js';
import { sendSuccess, sendError } from '../middleware/index.js';

const router: IRouter = Router();
let meetingManager: MeetingManager;

// 初始化会议管理器
const initializeMeetingManager = () => {
  if (!meetingManager) {
    meetingManager = new MeetingManager();
  }
  return meetingManager;
};

// 获取会议列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const manager = initializeMeetingManager();
    const { limit = 50, offset = 0 } = req.query;

    const meetings = await manager.listMeetings(
      parseInt(limit as string),
      parseInt(offset as string)
    );

    sendSuccess(res, { meetings });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取会议列表失败',
      500
    );
  }
});

// 创建新会议
router.post('/', async (req: Request, res: Response) => {
  try {
    const manager = initializeMeetingManager();
    const { title, description } = req.body;

    if (!title) {
      return sendError(res, '会议标题不能为空', 400);
    }

    const meeting = await manager.createMeeting(title, description);
    sendSuccess(res, { meeting });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '创建会议失败',
      500
    );
  }
});

// 获取特定会议
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const manager = initializeMeetingManager();
    const meeting = await manager.getMeeting(req.params.id!);

    if (!meeting) {
      return sendError(res, '会议不存在', 404);
    }

    sendSuccess(res, { meeting });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '获取会议失败',
      500
    );
  }
});

// 更新会议
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const manager = initializeMeetingManager();
    const meeting = await manager.updateMeeting(req.params.id!, req.body);

    if (!meeting) {
      return sendError(res, '会议不存在', 404);
    }

    sendSuccess(res, { meeting });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '更新会议失败',
      500
    );
  }
});

// 删除会议
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const manager = initializeMeetingManager();
    const success = await manager.deleteMeeting(req.params.id!);

    if (!success) {
      return sendError(res, '会议不存在', 404);
    }

    sendSuccess(res, { message: '会议删除成功' });
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : '删除会议失败',
      500
    );
  }
});

export default router;
